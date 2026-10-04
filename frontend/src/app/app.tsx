import {useCallback, useEffect, useMemo, useRef, useState} from 'preact/hooks';
import type {Activity, Category} from '../../../datos/contracts/entities';
import {Categories} from '../../../datos/contracts/entities';
import {localClock} from '../../../datos/domain/activities/public';
import type {CaptureContext} from '../../../datos/contracts/interpreter/public';
import {categoryLabels, type UiPort, type UiSnapshot} from '../shared/ui-contract';
import {ActivityEditor, ActivityList, CategoryFilters, type PickerRequest} from '../modules/activities/public';
import {HistoryScreen} from '../modules/history/public';
import {CaptureResult, CaptureScreen} from '../modules/capture/public';
import {TimerPanel} from '../modules/timer/public';
import {SettingsScreen} from '../modules/settings/public';
import {Sheet} from '../components/sheet';
import {DatePicker, TimePicker} from '../components/date-time-picker';
import {AppRouter} from './router';

export function App({port, router}: {port: UiPort; router: AppRouter}) {
  const [route, setRoute] = useState(() => router.route()), [snapshot, setSnapshot] = useState<UiSnapshot | null>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine), [picker, setPicker] = useState<PickerRequest | null>(null);
  const requestId = useRef(0);
  const operationActive = useRef(false);
  const refresh = useCallback(async () => {const id = ++requestId.current; const value = await port.snapshot(); if (id === requestId.current) setSnapshot(value);}, [port]);
  useEffect(() => router.subscribe(() => {setRoute(router.route()); setError('');}), [router]);
  useEffect(() => {document.querySelector<HTMLElement>('h1')?.focus(); window.scrollTo?.(0, 0);}, [route.path]);
  useEffect(() => {
    void refresh().catch(e => setError(String(e)));
    const visible = () => {if (!document.hidden) void refresh().catch(e => setError(String(e)));};
    const connection = () => setOnline(navigator.onLine);
    const timer = setInterval(visible, 60000);
    window.addEventListener('online', connection); window.addEventListener('offline', connection); document.addEventListener('visibilitychange', visible);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`gestor-${port.mode}`) : null;
    if (channel) channel.onmessage = visible;
    return () => {clearInterval(timer); window.removeEventListener('online', connection); window.removeEventListener('offline', connection); document.removeEventListener('visibilitychange', visible); channel?.close();};
  }, [refresh, port]);
  useEffect(() => {if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer);}, [notice]);
  const run = async (work: () => Promise<unknown>, message = 'Guardado en este dispositivo.', after?: () => void) => {
    if (operationActive.current) return;
    operationActive.current = true;
    setBusy(true); setError('');
    try {
      const result = await work();
      let refreshFailed = false;
      try {await refresh();} catch {refreshFailed = true;}
      setNotice(refreshFailed ? 'El cambio se guardó. Recarga para actualizar la vista; no necesitas volver a guardar.' : typeof result === 'string' ? result : message); after?.();
      if (refreshFailed) setError('El cambio se guardó, pero no se pudo actualizar la vista. Recarga para ver los datos; no necesitas volver a guardar.');
      if (typeof BroadcastChannel !== 'undefined') {const channel = new BroadcastChannel(`gestor-${port.mode}`); channel.postMessage('changed'); channel.close();}
    } catch (e) {setError(e instanceof Error ? e.message : String(e));}
    finally {operationActive.current = false; setBusy(false);}
  };
  const captureContext: CaptureContext = useMemo(() => {
    const capturedAt = new Date().toISOString(), zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const clock = localClock(capturedAt, zone);
    return {inputId: crypto.randomUUID(), capturedAt, localDate: clock.date, localTime: `${clock.time}:${capturedAt.slice(17, 19)}`, timeZone: zone};
  }, [route.path]);
  const selected = route.path.startsWith('/category/') ? decodeURIComponent(route.path.slice(10)) as Category : null;
  const category = selected && Categories.includes(selected) ? selected : null;
  const isList = route.path === '/' || route.path.startsWith('/category/');
  const activityId = route.path.startsWith('/activity/') ? decodeURIComponent(route.path.slice(10)) : null;
  const activity = snapshot?.all.find(a => a.id === activityId);
  const isNew = route.path === '/new';
  const isCapture = route.path === '/capture/write' || route.path === '/capture/voice';
  const resultId = route.path.startsWith('/capture/result/') ? route.path.slice(16) : null;
  const batch = snapshot?.batches.find(b => b.id === resultId);
  const titles = route.path === '/history' ? 'Historial' : route.path === '/settings' ? 'Configuración' : route.path === '/statistics' ? 'Estadísticas' :
    isNew ? 'Nueva actividad' : activityId ? 'Tu actividad' : route.path === '/capture/voice' ? 'Hablar' : route.path === '/capture/write' ? 'Escribir' : resultId ? 'Revisar pendientes' : 'Mis pendientes';
  const openPicker = (request: PickerRequest) => {setPicker(request); router.sheet(request.type);};
  const finish = (a: Activity, action: 'COMPLETE' | 'CANCEL' | 'DELETE') => {void run(() => port.finish(a, action), action === 'COMPLETE' ? 'Actividad realizada.' : action === 'CANCEL' ? 'Actividad cancelada. Está en tu historial.' : 'Registro eliminado.', () => router.returnToList());};
  return <div class="app-shell">
    <div class="page-surface" aria-hidden={Boolean(route.sheet)} inert={Boolean(route.sheet)}>
      <header class={`app-header ${isList ? 'home-header' : ''}`}>
        <div class="header-top"><span class="brand"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 5 5L20 6"/></svg> a tu ritmo</span><span class={`connection ${online ? '' : 'offline'}`}><i/>{online ? 'En este dispositivo' : 'Sin conexión'}</span></div>
        <div class="heading-row">{!isList || category ? <button class="icon-button back-button" aria-label="Volver" onClick={() => router.back()}>‹</button> : null}<h1 tabIndex={-1}>{titles}</h1><button class="icon-button menu-button" aria-label="Abrir menú" onClick={() => router.sheet('menu')}>☰</button></div>
        {isList && snapshot && <><p class="home-subtitle">{category ? categoryLabels[category] : 'Lo importante, a la vista.'}{port.mode === 'demo' && <span class="demo-label">Demo</span>}</p><CategoryFilters activities={snapshot.pending} selected={category} select={value => {const next = value ? `/category/${value}` : '/'; if (next !== route.path) router.go(next);}}/></>}
      </header>
      <main id="main" class={isList ? 'list-main' : 'screen-main'}>
        {error && <div class="error-box" role="alert">{error}</div>}
        {!snapshot ? <p class="loading">Abriendo tus pendientes…</p> : <>
          {isList && <ActivityList snapshot={snapshot} category={category} open={id => router.go(`/activity/${id}`)} timer={(a, action) => {void run(() => port.timer(a, action));}}/>}
          {(isNew || activity) && <ActivityEditor key={activity?.id ?? 'new'} activity={activity} groups={snapshot.groups} picker={openPicker} busy={busy}
            save={input => {void run(() => port.save(input, activity), 'Actividad guardada.', () => router.returnToList());}}>
            {activity && <>
              {activity.type === 'TASK' && <TimerPanel activity={activity} snapshot={snapshot} busy={busy} action={action => {void run(() => port.timer(activity, action));}} stop={() => router.sheet('stop')}/>}
              <div class="detail-actions">{activity.status === 'PENDING' && <><button type="button" class="complete-button" disabled={busy} onClick={() => finish(activity, 'COMPLETE')}>✓ Marcar realizada</button><button type="button" disabled={busy} onClick={() => router.sheet('cancel')}>Cancelar actividad</button></>}
                <button type="button" class="delete-button" onClick={() => router.sheet('delete')} disabled={busy}>Eliminar registro</button></div>
              <p class="detail-note">{activity.status === 'COMPLETED' ? 'Realizada' : activity.status === 'CANCELLED' ? 'Cancelada' : 'Pendiente'} · Creada {new Intl.DateTimeFormat('es', {dateStyle: 'medium'}).format(new Date(activity.createdAt))}</p>
            </>}
          </ActivityEditor>}
          {activityId && !activity && <div class="empty"><h2>Actividad no disponible</h2><p>Puede haber sido eliminada o pertenecer a otro espacio.</p><button onClick={() => router.returnToList()}>Volver a pendientes</button></div>}
          {route.path === '/history' && <HistoryScreen port={port} snapshot={snapshot} open={id => router.go(`/activity/${id}`)}/>}
          {route.path === '/settings' && <SettingsScreen port={port} run={work => {void run(work);}}/>}
          {route.path === '/statistics' && <div class="empty"><span class="empty-mark">↗</span><h2>Más adelante</h2><p>Las estadísticas estarán aquí en una próxima etapa. No hay datos simulados.</p></div>}
          {isCapture && <>{snapshot.batches.filter(b => b.state !== 'APPLIED').map(b => <button class="draft-link" key={b.id} onClick={() => router.go(`/capture/result/${b.id}`)}>Continuar borrador · {b.blockedOpIds.length} por aclarar</button>)}<CaptureScreen key={route.path} voice={route.path.endsWith('/voice')} port={port} context={captureContext} busy={busy} cancel={() => router.back()} interpret={(text, scenario, voiceContext) => {let preparedId: string; void run(async () => {
              const candidates = snapshot.pending.map(a => ({id: a.id, version: a.version}));
              const capturedAt = new Date().toISOString(), clock=localClock(capturedAt,captureContext.timeZone);
              const prepared = await port.capture({...captureContext,capturedAt,localDate:clock.date,localTime:`${clock.time}:${capturedAt.slice(17,19)}`, ...voiceContext, text, candidates}, false, scenario);
            preparedId = prepared.id;
            }, 'Propuesta preparada. Revisa antes de guardar.', () => router.go('/capture/result/' + preparedId));}}/></>}
          {batch && <CaptureResult batch={batch} activities={snapshot.all} busy={busy} real={port.interpreterMode === 'real'} clarify={port.interpreterMode === 'real' && port.resolveClarification ? (id,answer)=>{void run(()=>port.resolveClarification!(batch,id,answer),'Aclaración preparada.');} : undefined} apply={() => {void run(async () => {const applied = await port.apply(batch); if (applied.state === 'APPLIED') router.returnToList();}, 'Claras guardadas; las dudas siguen pendientes.');}}
            resolve={(id, time) => {void run(() => port.resolveTime(batch, id, time), 'Hora aclarada. Ya puedes guardar.');}}/>}
          {batch && <button class="save-button" onClick={() => router.returnToList()}>Volver a pendientes</button>}
          {resultId && !batch && <p>Este borrador no está disponible en este espacio.</p>}
          {!isList && !isNew && !activityId && !isCapture && !resultId && !['/history', '/settings', '/statistics'].includes(route.path) && <div class="empty"><h2>Página no encontrada</h2><button onClick={() => router.go('/', true)}>Inicio</button></div>}
        </>}
      </main>
      {isList && <button class="fab" aria-label="Agregar actividad" onClick={() => router.sheet('add')}>+</button>}
      <footer class="app-footer">{port.mode === 'demo' ? 'Espacio demo · datos separados' : 'Tu tiempo, tus pendientes.'}</footer>
    </div>
    {notice && <div class="toast" role="status">{notice}</div>}
    {route.sheet === 'add' && <Sheet title="Agregar" close={() => router.back()}><div class="capture-options">
      <button aria-label="Hablar" onClick={() => router.go('/capture/voice', true)}><span class="option-icon">♩</span><span><strong>Hablar</strong><small>Cuéntalo con tu voz</small></span><span>›</span></button>
      <button aria-label="Escribir" onClick={() => router.go('/capture/write', true)}><span class="option-icon">✎</span><span><strong>Escribir</strong><small>Todo en una sola entrada</small></span><span>›</span></button>
      <button aria-label="Crear manualmente" onClick={() => router.go('/new', true)}><span class="option-icon">+</span><span><strong>Crear manualmente</strong><small>Una actividad, a tu manera</small></span><span>›</span></button>
    </div></Sheet>}
    {route.sheet === 'menu' && <Sheet title="Tu espacio" close={() => router.back()}><nav class="menu-links" aria-label="Menú principal">
      {[['Inicio', '/'], ['Historial', '/history'], ['Estadísticas', '/statistics'], ['Configuración', '/settings']].map(([label, path]) => <button onClick={() => path === '/' ? router.home() : router.go(path!, true)}>{label}<span>›</span></button>)}
      <button disabled>Cerrar sesión <small>Disponible con autenticación</small></button>
    </nav></Sheet>}
    {route.sheet === 'date' && <DatePicker value={picker?.type === 'date' ? picker.value : null} today={localClock(snapshot?.now ?? new Date().toISOString(), snapshot?.timeZone ?? 'UTC').date} close={() => router.back()} confirm={value => {picker?.commit(value); router.back();}}/>}
    {route.sheet === 'time' && <TimePicker value={picker?.type === 'time' ? picker.value : null} close={() => router.back()} confirm={value => {picker?.commit(value); router.back();}}/>}
    {route.sheet === 'stop' && activity && <Sheet title="Detener sesión" close={() => router.back()}><p>El tiempo queda guardado. Tú decides si la actividad ya terminó.</p><div class="sheet-actions">
      <button disabled={busy} onClick={() => {void run(() => port.timer(activity, 'STOP'), undefined, () => router.back());}}>Solo detener</button>
      <button class="primary" disabled={busy} onClick={() => {void run(() => port.timer(activity, 'STOP_COMPLETE'), undefined, () => router.returnToList());}}>Detener y completar</button>
    </div></Sheet>}
    {(route.sheet === 'cancel' || route.sheet === 'delete') && activity && <Sheet title={route.sheet === 'cancel' ? 'Cancelar actividad' : 'Eliminar registro'} close={() => router.back()}>
      <p>{route.sheet === 'cancel' ? 'Dejará de estar pendiente y se conservará como cancelada en tu historial.' : 'Úsalo si la actividad se creó por error. El registro dejará de aparecer en pendientes e historial.'}</p><div class="sheet-actions"><button onClick={() => router.back()}>Volver</button><button class={route.sheet === 'delete' ? 'danger' : 'primary'} disabled={busy} onClick={() => finish(activity, route.sheet === 'cancel' ? 'CANCEL' : 'DELETE')}>{route.sheet === 'cancel' ? 'Confirmar cancelación' : 'Eliminar registro'}</button></div>
    </Sheet>}
  </div>;
}
