import {Categories, type Activity, type ActivityStatus, type WorkSession} from '../../contracts/entities';

export class DomainError extends Error {
  constructor(public readonly code: string, message: string) {super(message); this.name = 'DomainError';}
}
export function assert(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new DomainError(code, message);
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateActivity(activity: Activity): void {
  assert(typeof activity.title === 'string' && activity.title.trim().length > 0 && activity.title.length <= 300,
    'INVALID_TITLE', 'El nombre debe tener entre 1 y 300 caracteres.');
  assert(Categories.includes(activity.category), 'INVALID_CATEGORY', 'Categoría inválida.');
  assert(['TASK', 'COMMITMENT'].includes(activity.type), 'INVALID_TYPE', 'Tipo inválido.');
  assert(activity.dueDate === null || (typeof activity.dueDate === 'string' && validDate(activity.dueDate)),
    'INVALID_DATE', 'Fecha de calendario inválida.');
  assert(activity.dueTime === null || (typeof activity.dueTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(activity.dueTime)),
    'INVALID_TIME', 'Hora inválida.');
  assert(!activity.dueTime || activity.dueDate, 'TIME_WITHOUT_DATE', 'La hora requiere fecha.');
  assert(activity.reservedDurationMinutes === null || (activity.type === 'COMMITMENT' &&
    Number.isInteger(activity.reservedDurationMinutes) && activity.reservedDurationMinutes > 0),
    'INVALID_DURATION', 'La duración reservada es positiva y solo para compromisos.');
  assert(['PENDING', 'COMPLETED', 'CANCELLED'].includes(activity.status), 'INVALID_STATUS', 'Estado persistido inválido.');
  assert((activity.status === 'COMPLETED') === (activity.completedAt !== null) &&
    (activity.status === 'CANCELLED') === (activity.cancelledAt !== null), 'INVALID_STATUS', 'Fechas de estado incoherentes.');
  assert(Number.isInteger(activity.version) && activity.version > 0, 'INVALID_VERSION', 'Versión inválida.');
  try {new Intl.DateTimeFormat('es', {timeZone: activity.timeZone});}
  catch {throw new DomainError('INVALID_ZONE', 'Zona horaria inválida.');}
}
export function effectiveStatus(activity: Activity, sessions: WorkSession[]): ActivityStatus {
  return activity.status === 'PENDING' && sessions.some(s => s.activityId === activity.id && s.state === 'RUNNING')
    ? 'IN_PROGRESS' : activity.status;
}
export function localClock(instant: string, timeZone: string): {date: string; time: string} {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(new Date(instant));
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return {date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}`};
}
export type TemporalBucket = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'FUTURE' | 'UNDATED';
export function temporalBucket(a: Activity, clock: {date: string; time: string}): TemporalBucket {
  if (!a.dueDate) return 'UNDATED';
  if (a.dueDate < clock.date || (a.dueDate === clock.date && a.dueTime !== null && a.dueTime < clock.time)) return 'OVERDUE';
  if (a.dueDate === clock.date) return 'TODAY';
  const days = (Date.parse(`${a.dueDate}T00:00:00Z`) - Date.parse(`${clock.date}T00:00:00Z`)) / 86400000;
  return days <= 7 ? 'UPCOMING' : 'FUTURE';
}
export function sortPending(activities: Activity[], instant: string, zone: string): Activity[] {
  const clock = localClock(instant, zone);
  const ranks: Record<TemporalBucket, number> = {OVERDUE: 0, TODAY: 1, UPCOMING: 2, FUTURE: 3, UNDATED: 4};
  return activities.filter(a => !a.deletedAt && a.status === 'PENDING').sort((a, b) =>
    ranks[temporalBucket(a, clock)] - ranks[temporalBucket(b, clock)] ||
    (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
    (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99') ||
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
