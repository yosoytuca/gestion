import {useEffect, useState} from 'preact/hooks';
import type {Activity} from '../../../../datos/contracts/entities';
import type {UiSnapshot} from '../../shared/ui-contract';
import {activeMilliseconds} from '../../../../datos/domain/sessions/public';
export function formatDuration(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
export function TimerPanel({activity, snapshot, action, stop, busy}: {activity: Activity; snapshot: UiSnapshot;
  action(value: 'START' | 'PAUSE' | 'RESUME' | 'STOP_COMPLETE'): void; stop(): void; busy: boolean}) {
  const [, setTick] = useState(0);
  const [baseline, setBaseline] = useState(() => ({wall: Date.now(), instant: Date.parse(snapshot.now)}));
  useEffect(() => {setBaseline({wall: Date.now(), instant: Date.parse(snapshot.now)});}, [snapshot.now]);
  useEffect(() => {const timer = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(timer);}, []);
  const now = new Date(baseline.instant + Math.max(0, Date.now() - baseline.wall)).toISOString();
  const session = snapshot.sessions.find(s => s.activityId === activity.id && s.deviceId === snapshot.deviceId && s.state !== 'STOPPED');
  let time: string;
  try {time = snapshot.conflictedActivityIds.includes(activity.id) ? 'Por resolver' : formatDuration(activeMilliseconds(snapshot.intervals.filter(i => i.activityId === activity.id), now));}
  catch {time = 'Revisar reloj';}
  const running = session?.state === 'RUNNING';
  return <section class="timer-panel" aria-label="Registro de tiempo"><span>Tiempo activo</span><strong class="timer-digits">{time}</strong>
    {activity.status === 'PENDING' && <div class="timer-actions"><button type="button" class="primary" disabled={busy} onClick={() => action(running ? 'STOP_COMPLETE' : session ? 'RESUME' : 'START')}>
      <span aria-hidden="true">{running ? '✓' : '▶'}</span> {running ? 'Completar' : session ? 'Continuar' : 'Iniciar'}</button>
      {running && <button type="button" disabled={busy} onClick={() => action('PAUSE')}>Ⅱ Pausar</button>}
      {session && <button type="button" disabled={busy} onClick={stop}>⏹ Detener</button>}</div>}
  </section>;
}
