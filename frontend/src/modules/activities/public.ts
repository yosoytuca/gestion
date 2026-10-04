import type {Activity, ActivityInput, ActivityPatch} from '../../../../datos/contracts/entities';
import type {CommandContext, Repositories} from '../../../../datos/contracts/repositories/public';
import {assert, validateActivity} from '../../../../datos/domain/activities/public';
export {categoryCounts, filterCategory, sections, relativeDate} from './presentation';
export {ActivityList, CategoryFilters} from './ui';
export {ActivityEditor, type PickerRequest} from './editor';

export async function getActivity(r: Repositories, userId: string, id: string, version?: number): Promise<Activity> {
  const a = await r.activities.get(id);
  assert(a && a.userId === userId, 'MISSING_TARGET', 'Actividad no disponible para este usuario.');
  assert(!a.deletedAt, 'DELETED_TARGET', 'La actividad fue eliminada.');
  if (version !== undefined) assert(a.version === version, 'STALE_TARGET', 'La actividad cambió de versión.');
  return a;
}
async function validateGroup(r: Repositories, a: Activity): Promise<void> {
  if (a.groupId) {
    const group = await r.groups.get(a.groupId);
    assert(group && group.userId === a.userId && !group.deletedAt, 'INVALID_GROUP', 'Grupo no disponible.');
  }
}
export async function createActivity(r: Repositories, c: CommandContext, input: ActivityInput): Promise<Activity> {
  const now = c.now();
  const a: Activity = {id: c.id(), userId: c.userId, title: input.title.trim(), category: input.category,
    type: input.type, groupId: input.groupId ?? null, dueDate: input.dueDate ?? null, dueTime: input.dueTime ?? null,
    reservedDurationMinutes: input.reservedDurationMinutes ?? null, timeZone: c.timeZone,
    status: 'PENDING', createdAt: now, updatedAt: now, version: 1, completedAt: null, cancelledAt: null, deletedAt: null};
  validateActivity(a); await validateGroup(r, a);
  await c.save('activity', a, 'CREATE', null); return a;
}
export async function updateActivity(r: Repositories, c: CommandContext, id: string, patch: ActivityPatch, version?: number): Promise<Activity> {
  const previous = await getActivity(r, c.userId, id, version);
  assert(previous.status === 'PENDING', 'TERMINAL_ACTIVITY', 'No editar actividades terminadas.');
  const allowed = ['title', 'category', 'type', 'groupId', 'dueDate', 'dueTime', 'reservedDurationMinutes'];
  assert(Object.keys(patch).length > 0 && Object.keys(patch).every(k => allowed.includes(k)), 'INVALID_PATCH', 'Campos no editables.');
  const a = {...previous, ...patch, updatedAt: c.now(), version: previous.version + 1};
  if (typeof a.title === 'string') a.title = a.title.trim();
  validateActivity(a); await validateGroup(r, a);
  if (a.type === 'COMMITMENT') {
    const unfinished = (await r.sessions.list()).some(s => s.activityId === id && s.userId === c.userId && s.state !== 'STOPPED');
    assert(!unfinished, 'SESSION_EXISTS', 'Detén la sesión antes de convertir la tarea en compromiso.');
  }
  await c.save('activity', a, 'UPDATE', previous); return a;
}
export async function finishActivity(r: Repositories, c: CommandContext, id: string,
  action: 'COMPLETE' | 'CANCEL' | 'DELETE', version?: number): Promise<Activity> {
  const previous = await getActivity(r, c.userId, id, version);
  assert(action === 'DELETE' || previous.status === 'PENDING', 'TERMINAL_ACTIVITY', 'La actividad ya terminó.');
  const now = c.now();
  const a: Activity = {...previous, updatedAt: now, version: previous.version + 1,
    ...(action === 'COMPLETE' ? {status: 'COMPLETED', completedAt: now} : {}),
    ...(action === 'CANCEL' ? {status: 'CANCELLED', cancelledAt: now} : {}),
    ...(action === 'DELETE' ? {deletedAt: now} : {})};
  validateActivity(a); await c.save('activity', a, action, previous); return a;
}
