import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {render} from 'preact';
import {act} from 'preact/test-utils';
import {fixture} from './helpers';
import {App} from '../frontend/src/app/app';
import {AppRouter} from '../frontend/src/app/router';
import {UiController} from '../frontend/src/app/application/ui-controller';
import {seedDemo} from '../frontend/src/app/application/demo-data';
import {FixtureInterpreterProvider, FixtureVoiceProvider} from '../frontend/src/infrastructure/providers/mock-capture';
import {CaptureService} from '../frontend/src/modules/capture/public';
import {CaptureContextStore} from '../frontend/src/infrastructure/providers/capture-context-store';
import {categoryCounts, filterCategory, sections} from '../frontend/src/modules/activities/public';
import {periodFilter} from '../frontend/src/modules/history/public';
import {startApplication} from '../frontend/src/app/initialization/start';
import {registerUpdates} from '../frontend/src/app/initialization/updates';
import {exportBackup} from '../frontend/src/app/application/backup';
import {RealInterpreterProvider} from '../frontend/src/infrastructure/providers/real-interpreter';
import {CaptureScreen} from '../frontend/src/modules/capture/public';

const wait = (time = 60) => new Promise(resolve => setTimeout(resolve, time));
test('Micrófono real: permiso → grabación → terminar → transcripción → interpretación automática',async t=>{
  const f=await mounted('/capture/voice',false,async()=>new Response('{}'));t.after(f.cleanup);
  const events:string[]=[];let interpreted='';
  const context={inputId:crypto.randomUUID(),capturedAt:'2026-10-04T12:30:00Z',localDate:'2026-10-04',localTime:'07:30:00',timeZone:'America/Bogota'};
  f.port.beginVoice=async()=>{events.push('permission-and-record');};
  f.port.finishVoice=async()=>{events.push('transcribe');return {text:'Mañana cita médica',language:'es',context};};
  f.port.cancelVoice=()=>{events.push('cancel');};
  act(()=>render(<CaptureScreen voice port={f.port} context={context} busy={false} cancel={()=>{}} interpret={(text,_scenario,capture)=>{events.push('interpret');interpreted=text;assert.deepEqual(capture,context);}}/>,f.root));
  await f.click('[aria-label="Iniciar grabación"]');assert.match(f.root.textContent!,/Grabando/);
  await f.click('[aria-label="Terminar y procesar audio"]');assert.equal(interpreted,'Mañana cita médica');assert.deepEqual(events.slice(-3),['permission-and-record','transcribe','interpret']);
});
test('Escribir real HTTP (transporte simulado): crear, mover, completar en IndexedDB y manual tras caída',async t=>{
  let step=0;
  const transport:typeof fetch=async(_url,init)=>{
    const r=JSON.parse(init!.body as string);let operations:any[];
    if(step===0) operations=['Cotización de pintura','Cotización de acrílicos'].map((title,i)=>({opId:`c-${i}`,action:'CREATE',evidence:r.input.text,fields:{title,category:'WORK',type:'TASK',dueDate:r.input.localDate,dueTime:null,reservedDurationMinutes:null,groupRef:null}}));
    else if(step===1){const target=r.candidateDetails.find((c:any)=>c.title.includes('pintura'));assert.ok(target);operations=[{opId:'move',action:'UPDATE',evidence:r.input.text,targetId:target.id,expectedVersion:target.version,patch:{dueDate:'2026-10-10'}}];}
    else if(step===2){const target=r.candidateDetails.find((c:any)=>c.title.includes('pintura'));assert.ok(target);operations=[{opId:'done',action:'COMPLETE',evidence:r.input.text,targetId:target.id,expectedVersion:target.version}];}
    else throw new Error('Endpoint apagado');
    step++;return new Response(JSON.stringify({schemaVersion:'1.1',inputId:r.input.inputId,operations,clarifications:[]}));
  };
  const f=await mounted('/capture/write',false,transport);t.after(f.cleanup);
  const settled=async()=>{await act(async()=>{for(let i=0;i<30;i++){await wait(30);if(!f.root.querySelector('button.primary:disabled'))break;}});};
  assert.match(f.root.textContent!,/Interpretación con IA/);assert.ok(!f.root.querySelector('select'));
  await f.input('textarea','Hoy cotizar pintura y acrílicos');await f.button('Interpretar');await settled();
  assert.equal((await f.kernel.pending()).length,0);assert.match(f.root.textContent!,/Cotización de pintura/);
  await f.button('Guardar actividades revisadas');await settled();assert.equal((await f.kernel.pending()).length,2);
  for(const text of ['Pasa la cotización de pintura al día 10','Ya terminé la cotización de pintura']){
    await act(async()=>{f.router.go('/capture/write');await wait();});await f.input('textarea',text);await f.button('Interpretar');await settled();await f.button('Guardar actividades revisadas');await settled();
  }
  const all=await f.uow.read(r=>r.activities.list()),paint=all.find(a=>a.title.includes('pintura'))!;
  assert.equal(paint.dueDate,'2026-10-10');assert.equal(paint.status,'COMPLETED');assert.equal(paint.version,3);
  assert.equal((await f.uow.read(r=>r.outbox.list())).length,4);
  await act(async()=>{f.router.go('/capture/write');await wait();});await f.input('textarea','Crear algo');await f.button('Interpretar');assert.match(f.root.textContent!,/No se pudo conectar/);
  await act(async()=>{f.router.go('/new');await wait();});await f.input('input[name="title"]','Manual independiente');await f.button('Crear actividad');assert.equal((await f.kernel.pending()).length,2);
});
test('Texto tras fallo sobrevive a salir y volver; propuesta manual editable se guarda sin otra llamada IA',async t=>{
  let calls=0;
  const f=await mounted('/capture/write',false,async()=>{calls++;throw new Error('Sin conexión');});t.after(f.cleanup);
  await f.input('textarea','Texto de prueba recuperable');await f.button('Interpretar');
  await act(async()=>{f.router.go('/');await wait();});
  await act(async()=>{f.router.go('/capture/write');await wait();});
  assert.equal(f.root.querySelector<HTMLTextAreaElement>('textarea')!.value,'Texto de prueba recuperable');
  await f.button('Preparar manualmente sin IA');
  await f.click('details summary');await f.input('details input','Actividad corregida');
  await f.button('Aplicar edición sin IA');await f.button('Guardar actividades revisadas');
  assert.equal((await f.kernel.pending())[0]!.title,'Actividad corregida');assert.equal(calls,1);
});

async function mounted(path = '/', demo = false, realTransport?:typeof fetch) {
  const f = await fixture(demo ? 'demo' : 'user');
  if (demo) await seedDemo(f.kernel);
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url: `http://localhost${path}`, pretendToBeVisual: true});
  for (const [key, value] of Object.entries({window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window)}))
    Object.defineProperty(globalThis, key, {value, configurable: true});
  dom.window.scrollTo = () => {};
  const voice = new FixtureVoiceProvider();
  const port = new UiController(f.kernel, {mode: demo ? 'demo' : 'personal', voice,
    contextStore:new CaptureContextStore(dom.window.localStorage,'capture-test'),
    interpreterMode:realTransport?'real':'mock',
    capture: (scenario,request) => new CaptureService(realTransport ? new RealInterpreterProvider(input=>request??{input,candidateDetails:[],recentIds:[]},realTransport) : new FixtureInterpreterProvider(scenario), voice), switchMode: async () => {}});
  const router = new AppRouter(dom.window), root = dom.window.document.querySelector('#root')!;
  const rerender = async () => {act(() => {render(<App port={port} router={router}/>, root);}); await act(async () => {await wait(80);});};
  await rerender();
  const click = async (selector: string) => {await act(async () => {const target = root.querySelector<HTMLButtonElement>(selector); assert.ok(target, selector); target.click(); await wait();});};
  const button = async (text: string) => {await act(async () => {const target = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === text); assert.ok(target, text); target.click(); await wait();});};
  const input = async (selector: string, value: string) => {await act(async () => {const target = root.querySelector<HTMLInputElement>(selector); assert.ok(target, selector); target.value = value; target.dispatchEvent(new dom.window.Event('input', {bubbles: true})); await wait(10);});};
  const cleanup = () => {act(() => render(null, root)); router.dispose(); f.uow.close(); dom.window.close();};
  return {...f, dom, root, port, router, click, button, input, rerender, cleanup};
}

test('UI manual → servicio → IndexedDB/outbox; filtros y contadores actualizados', async t => {
  const f = await mounted(); t.after(f.cleanup);
  await f.click('[aria-label="Agregar actividad"]'); await f.click('[aria-label="Crear manualmente"]');
  assert.equal(f.router.route().path, '/new');
  await f.input('input[name="title"]', 'Leer informe'); await f.click('[aria-label="Educación"]'); await f.button('Crear actividad');
  await act(async () => {await wait();});
  assert.equal(f.router.route().path, '/');
  assert.match(f.root.textContent!, /Leer informe/);
  assert.equal((await f.kernel.pending())[0]?.category, 'EDUCATION');
  assert.equal((await f.uow.read(r => r.outbox.list())).length, 1);
  assert.ok(f.root.querySelector('[aria-label="Educación: 1 pendientes"]'));
  await f.click('[aria-label="Trabajo: 0 pendientes"]');
  assert.equal(f.router.route().path, '/category/WORK'); assert.ok(!f.root.querySelector('[aria-label="Abrir Leer informe"]'));
});
test('UI edición y completar: conservar servicio/versiones e historial buscable', async t => {
  const f = await mounted('/new'); t.after(f.cleanup);
  await f.input('input[name="title"]', 'Cotización'); await f.button('Crear actividad'); await act(async () => {await wait();});
  await f.click('[aria-label="Abrir Cotización"]'); await f.input('input[name="title"]', 'Cotización de acrílicos'); await f.button('Guardar cambios'); await act(async () => {await wait();});
  assert.equal((await f.kernel.pending())[0]?.version, 2);
  await f.click('[aria-label="Abrir Cotización de acrílicos"]'); await f.button('✓ Marcar realizada'); await act(async () => {await wait();});
  await f.click('[aria-label="Abrir menú"]'); await f.button('Historial›');
  await act(async () => {await wait(200);});
  assert.equal(f.router.route().path, '/history'); assert.match(f.root.textContent!, /Realizada/);
  await f.input('[aria-label="Buscar en historial"]', 'acrilicos'); await act(async () => {await wait(200);});
  assert.match(f.root.textContent!, /Cotización de acrílicos/);
});
test('Calendario con confirmar/cancelar, hora 24h y validar hora sin fecha', async t => {
  const f = await mounted('/new'); t.after(f.cleanup);
  await f.input('input[name="title"]', 'Cita');
  await f.button('Sin hora ◷');
  const hour = f.root.querySelector<HTMLSelectElement>('[aria-label="Seleccionar hora"]')!;
  await act(async () => {hour.value = '16'; hour.dispatchEvent(new f.dom.window.Event('change', {bubbles: true}));});
  await f.button('Confirmar'); await act(async () => {await wait();});
  assert.match(f.root.textContent!, /La hora necesita una fecha/);
  assert.equal([...f.root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Crear actividad')?.disabled, true);
  await f.button('Sin fecha ▦');
  await f.click('[aria-label="Mes siguiente"]');
  const day = f.root.querySelector<HTMLButtonElement>('[aria-label^="Seleccionar 2026-"]')!;
  assert.ok(day); await act(async () => {day.click();});
  await f.button('Confirmar'); await act(async () => {await wait();});
  await f.button('Crear actividad'); await act(async () => {await wait();});
  const a = (await f.kernel.pending())[0]!; assert.ok(a.dueDate); assert.equal(a.dueTime, '16:00');
});
test('Navegación root → categoría → actividad → hoja; Back deshace cada nivel y refresh conserva ruta', async t => {
  const f = await mounted('/', true); t.after(f.cleanup);
  await f.click('[aria-label^="Educación:"]');
  const categoryPath = f.router.route().path;
  const activityButton = f.root.querySelector<HTMLButtonElement>('[aria-label^="Abrir Preparar"]')!;
  await act(async () => {activityButton.click(); await wait();});
  const activityPath = f.router.route().path;
  await f.button('Cancelar actividad'); assert.equal(f.router.route().sheet, 'cancel');
  await act(async () => {f.router.back(); await wait();}); assert.equal(f.router.route().path, activityPath); assert.equal(f.router.route().sheet, null);
  const refreshed = new AppRouter(f.dom.window); assert.equal(refreshed.route().path, activityPath); refreshed.dispose();
  await act(async () => {f.router.back(); await wait();}); assert.equal(f.router.route().path, categoryPath);
  await act(async () => {f.router.back(); await wait();}); assert.equal(f.router.route().path, '/');
});
test('Botón de tarjeta inicia y al pulsarlo de nuevo completa y guarda la sesión', async t => {
  const f = await mounted('/', true); t.after(f.cleanup);
  await f.click('[aria-label="Iniciar Cotización de acrílicos"]');
  await f.click('[aria-label="Completar Cotización de acrílicos"]');
  assert.ok(!(await f.kernel.pending()).some(a=>a.title==='Cotización de acrílicos'));
  assert.ok((await f.kernel.history()).some(a=>a.title==='Cotización de acrílicos' && a.status==='COMPLETED'));
  assert.ok(!f.root.querySelector('[aria-label="Completar Cotización de acrílicos"]'));
});

test('Timer UI usa núcleo: pausar anterior, detener separado de completar', async t => {
  const f = await mounted('/', true); t.after(f.cleanup);
  await f.click('[aria-label="Iniciar Cotización de acrílicos"]');
  await f.click('[aria-label="Iniciar Cotización de instalación de letreros"]');
  assert.match(f.root.textContent!, /Se pausó Cotización de acrílicos/);
  await f.click('[aria-label="Abrir Cotización de instalación de letreros"]');
  await f.button('Ⅱ Pausar'); await f.button('▶ Continuar'); await f.button('⏹ Detener'); await f.button('Solo detener'); await act(async () => {await wait();});
  assert.equal((await f.kernel.pending()).find(a => a.title.includes('instalación'))?.status, 'PENDING');
  assert.match(f.root.textContent!, /Tiempo activo/);
  await f.button('▶ Iniciar'); await f.button('⏹ Detener'); await f.button('Detener y completar'); await act(async () => {await wait();});
  assert.ok((await f.kernel.history()).some(a => a.title.includes('instalación')));
});
test('UI grupo expandible conserva progreso y orden; demo no se carga en personal', async t => {
  const f = await mounted('/', true); t.after(f.cleanup);
  assert.match(f.root.textContent!, /1\/4 completadas/);
  const group = f.root.querySelector<HTMLButtonElement>('.group-heading')!;
  await act(async () => {group.click(); await wait();}); assert.equal(group.getAttribute('aria-expanded'), 'false');
  assert.ok(!f.root.querySelector('[aria-label="Abrir Cotización de acrílicos"]'));
  await act(async () => {group.click(); await wait();}); assert.ok(f.root.querySelector('[aria-label="Abrir Cotización de acrílicos"]'));
  const personal = await fixture('personal');
  await assert.rejects(seedDemo(personal.kernel), /solo se cargan/); personal.uow.close();
});
test('Captura escrita mock → claras guardadas, hora por aclarar y resolución sin duplicados', async t => {
  const f = await mounted('/capture/write'); t.after(f.cleanup);
  await f.input('textarea', 'Hoy cotizaciones y mañana médico a las cuatro'); await f.button('Interpretar');
  assert.ok(f.router.route().path.startsWith('/capture/result/')); assert.match(f.root.textContent!, /por aclarar/);
  await f.button('Guardar claras'); assert.equal((await f.kernel.pending()).length, 5); // 4 quotes + thesis.
  await f.button('16:00'); await f.button('Guardar claras'); await act(async () => {await wait();});
  assert.equal((await f.kernel.pending()).length, 6); assert.equal(f.router.route().path, '/');
});
test('Voz simulada muestra texto, sin pedir permisos de micrófono', async t => {
  const f = await mounted('/capture/voice'); t.after(f.cleanup);
  await f.click('[aria-label="Simular captura de voz"]');
  assert.match(f.root.querySelector<HTMLTextAreaElement>('textarea')!.value, /cuatro cotizaciones/);
  assert.match(f.root.textContent!, /sin IA ni micrófono/);
  await f.button('Interpretar'); assert.ok(f.router.route().path.startsWith('/capture/result/'));
});
test('Proyecciones mantienen contadores/orden y periodo de historial local', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  await f.kernel.create({title: 'Hoy', category: 'EDUCATION', type: 'TASK', dueDate: '2026-10-03'});
  await f.kernel.create({title: 'Mañana', category: 'HEALTH', type: 'COMMITMENT', dueDate: '2026-10-04'});
  const pending = await f.kernel.pending();
  assert.equal(categoryCounts(pending).ALL, 2); assert.equal(filterCategory(pending, 'HEALTH').length, 1);
  assert.deepEqual(sections(pending, f.runtime.now(), f.runtime.timeZone).map(s => s.name), ['Hoy', 'Mañana']);
  assert.deepEqual(periodFilter('WEEK', f.runtime.now(), f.runtime.timeZone), {from: '2026-09-28', to: '2026-10-04'});
});

test('Cancelar y eliminar usan acciones distintas; logout permanece deshabilitado', async t => {
  const f = await mounted('/new'); t.after(f.cleanup);
  await f.input('input[name="title"]', 'Cita de prueba'); await f.button('Crear actividad'); await act(async () => {await wait();});
  await f.click('[aria-label="Abrir Cita de prueba"]'); await f.button('Cancelar actividad');
  assert.match(f.root.textContent!, /se conservará como cancelada/);
  await f.button('Confirmar cancelación'); await act(async () => {await wait();});
  assert.equal((await f.kernel.history())[0]?.status, 'CANCELLED');
  await f.click('[aria-label="Abrir menú"]');
  const logout = [...f.root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.startsWith('Cerrar sesión'))!;
  assert.equal(logout.disabled, true);
  await f.button('Historial›'); await act(async () => {await wait(200);});
  await f.click('[aria-label="Abrir Cita de prueba"]'); await f.button('Eliminar registro');
  assert.match(f.root.textContent!, /se creó por error/);
  const confirm = f.root.querySelector<HTMLButtonElement>('[role="dialog"] .danger')!;
  await act(async () => {confirm.click(); await wait();});
  assert.equal((await f.kernel.history()).length, 0);
  assert.ok((await f.uow.read(r => r.activities.list()))[0]?.deletedAt);
});
test('Grupo con hijos en distintas fechas aparece en cada bloque sin alterar orden', async t => {
  const f = await mounted('/', true); t.after(f.cleanup);
  const child = (await f.kernel.pending()).find(a => a.title.includes('acrílicos'))!;
  await f.kernel.update(child.id, {dueDate: '2026-10-04', dueTime: '17:00'});
  await act(async () => {f.dom.window.document.dispatchEvent(new f.dom.window.Event('visibilitychange')); await wait();});
  assert.ok(f.root.querySelector('section[aria-label="Mañana"] [aria-label="Abrir Cotización de acrílicos"]'));
  assert.equal(f.root.querySelectorAll('.group-heading').length, 2);
  assert.equal((await f.kernel.pending()).find(a => a.id === child.id)?.groupId, child.groupId);
});

test('UI guardado confirmado con refresh fallido no vuelve a crear actividad', async t => {
  const f = await mounted('/new'); t.after(f.cleanup);
  await f.input('input[name="title"]', 'Una sola vez');
  const original = f.port.snapshot.bind(f.port);
  f.port.snapshot = async () => {throw new Error('fallo lectura');};
  await f.button('Crear actividad');
  assert.match(f.root.textContent!, /El cambio se guardó/);
  assert.equal(f.router.route().path, '/');
  assert.equal((await f.kernel.pending()).filter(a => a.title === 'Una sola vez').length, 1);
  f.port.snapshot = original;
});

test('UI arranque fallido muestra error y Reintentar recupera sin resetear datos', async t => {
  const f = await mounted(); t.after(f.cleanup);
  await f.kernel.create({title: 'Conservada', category: 'PERSONAL', type: 'TASK'});
  act(() => render(null, f.root));
  let attempts = 0;
  await act(async () => {
    startApplication(f.root as HTMLElement, {prepareApplication: async () => {
      if (++attempts === 1) throw new Error('Almacenamiento bloqueado');
      return {controller: f.port, kernel: f.kernel, close() {}};
    }, registerUpdates: async () => {}});
    await wait();
  });
  assert.match(f.root.textContent!, /Almacenamiento bloqueado/);
  await f.button('Reintentar'); await act(async () => {await wait(100);});
  assert.match(f.root.textContent!, /Conservada/); assert.equal(attempts, 2);
});

test('UI respaldo requiere confirmación y restaura mediante servicios locales', async t => {
  const f = await mounted('/settings'); t.after(f.cleanup);
  const source = await fixture(); t.after(() => source.uow.close());
  await source.kernel.create({title: 'Restaurada', category: 'HEALTH', type: 'COMMITMENT'});
  const text = await exportBackup(source.uow, source.runtime);
  const input = f.root.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', {value: [{name: 'respaldo.json', size: text.length, text: async () => text}]});
  await act(async () => {input.dispatchEvent(new f.dom.window.Event('change', {bubbles: true})); await wait();});
  await f.button('Restaurar respaldo'); assert.equal((await f.kernel.pending()).length, 0);
  await f.button('Confirmar restauración'); assert.equal((await f.kernel.pending())[0]?.title, 'Restaurada');
  assert.match(f.root.textContent!, /Respaldo restaurado/);
});

test('UI actualización web no activa worker hasta segunda confirmación', async t => {
  const f = await mounted(); t.after(f.cleanup);
  let messages = 0;
  const serviceWorker = {controller: {}, addEventListener() {}, register: async () => ({waiting: {postMessage: () => {messages++;}}, addEventListener() {}})};
  Object.defineProperty(f.dom.window.navigator, 'serviceWorker', {value: serviceWorker, configurable: true});
  await registerUpdates(f.root as HTMLElement);
  const panel = f.dom.window.document.querySelector('#pwa-update')!;
  const button = panel.querySelector<HTMLButtonElement>('button')!;
  button.click(); assert.equal(messages, 0); assert.equal(button.textContent, 'Confirmar actualización');
  button.click(); assert.equal(messages, 1); assert.ok(button.disabled);
});
