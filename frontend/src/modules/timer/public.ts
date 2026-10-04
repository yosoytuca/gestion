import type {Activity, WorkSession} from '../../../../datos/contracts/entities';
import type {CommandContext, Repositories} from '../../../../datos/contracts/repositories/public';
import {assert} from '../../../../datos/domain/activities/public';
import {activeMilliseconds} from '../../../../datos/domain/sessions/public';
export {TimerPanel, formatDuration} from './ui';

export async function getSession(r: Repositories, c: CommandContext, id: string): Promise<WorkSession> {
  const session = await r.sessions.get(id);
  assert(session && session.userId === c.userId && session.deviceId === c.deviceId, 'MISSING_SESSION', 'Sesión no disponible en este dispositivo.');
  return session;
}
export async function pauseSession(r: Repositories, c: CommandContext, id: string): Promise<WorkSession> {
  const s = await getSession(r, c, id);
  assert(s.state === 'RUNNING', 'INVALID_TRANSITION', 'Solo una sesión activa puede pausarse.');
  await closeInterval(r, c, s);
  const next: WorkSession = {...s, state: 'PAUSED', updatedAt: c.now(), version: s.version + 1};
  await c.save('session', next, 'PAUSE', s); return next;
}
async function closeInterval(r: Repositories, c: CommandContext, s: WorkSession): Promise<void> {
  const open = (await r.intervals.list()).filter(i => i.sessionId === s.id && i.endedAt === null);
  assert(open.length === 1, 'INVALID_INTERVAL', 'La sesión activa requiere exactamente un intervalo abierto.');
  const interval = open[0]!;
  activeMilliseconds([interval], c.now());
  await c.save('interval', {...interval, endedAt: c.now(), updatedAt: c.now(), version: interval.version + 1}, 'CLOSE', interval);
}
async function openInterval(c: CommandContext, s: WorkSession): Promise<void> {
  const now = c.now();
  await c.save('interval', {id: c.id(), userId: c.userId, activityId: s.activityId, sessionId: s.id,
    deviceId: c.deviceId, startedAt: now, endedAt: null, createdAt: now, updatedAt: now, version: 1}, 'OPEN', null);
}
async function pauseOther(r: Repositories, c: CommandContext, exceptId?: string): Promise<void> {
  const running = (await r.sessions.list()).filter(s => s.userId === c.userId && s.state === 'RUNNING' && s.id !== exceptId);
  assert(running.every(s => s.deviceId === c.deviceId), 'REMOTE_SESSION_ACTIVE',
    'Hay una sesión activa de otro dispositivo; detén o resuelve esa sesión antes de iniciar otra.');
  for (const session of running) await pauseSession(r, c, session.id);
}
export async function startSession(r: Repositories, c: CommandContext, a: Activity): Promise<WorkSession> {
  assert(a.type === 'TASK' && a.status === 'PENDING' && !a.deletedAt, 'NOT_WORKABLE', 'Solo tareas pendientes admiten contador.');
  const existing = (await r.sessions.list()).find(s => s.activityId === a.id && s.deviceId === c.deviceId && s.userId === c.userId && s.state !== 'STOPPED');
  if (existing) {
    assert(existing.state === 'PAUSED', 'ALREADY_RUNNING', 'Esta actividad ya está activa.');
    return resumeSession(r, c, existing.id, a);
  }
  await pauseOther(r, c);
  const now = c.now();
  const s: WorkSession = {id: c.id(), userId: c.userId, activityId: a.id, deviceId: c.deviceId,
    state: 'RUNNING', startedAt: now, stoppedAt: null, createdAt: now, updatedAt: now, version: 1};
  await c.save('session', s, 'START', null); await openInterval(c, s); return s;
}
export async function resumeSession(r: Repositories, c: CommandContext, id: string, a: Activity): Promise<WorkSession> {
  const s = await getSession(r, c, id);
  assert(s.state === 'PAUSED' && s.activityId === a.id && a.status === 'PENDING' && a.type === 'TASK' && !a.deletedAt,
    'INVALID_TRANSITION', 'No se puede continuar esta sesión.');
  await pauseOther(r, c, id);
  const next: WorkSession = {...s, state: 'RUNNING', updatedAt: c.now(), version: s.version + 1};
  await c.save('session', next, 'RESUME', s); await openInterval(c, next); return next;
}
export async function stopSession(r: Repositories, c: CommandContext, id: string): Promise<WorkSession> {
  const s = await getSession(r, c, id);
  assert(s.state !== 'STOPPED', 'INVALID_TRANSITION', 'La sesión ya está detenida.');
  if (s.state === 'RUNNING') await closeInterval(r, c, s);
  const next: WorkSession = {...s, state: 'STOPPED', stoppedAt: c.now(), updatedAt: c.now(), version: s.version + 1};
  await c.save('session', next, 'STOP', s); return next;
}
