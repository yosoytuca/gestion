import {assert, localClock, validDate} from './public';
export type CalendarExpression =
  | {kind: 'TODAY'}
  | {kind: 'DAY_OFFSET'; days: number}
  | {kind: 'MINUTE_OFFSET'; minutes: number}
  | {kind: 'WEEKDAY'; weekday: number}
  | {kind: 'NEXT_WEEK_WEEKDAY'; weekday: number}
  | {kind: 'DAY_OF_MONTH'; day: number}
  | {kind: 'NEXT_WEEK'};
export type CalendarResolution = {date: string; time: string | null} | {start: string; end: string};
/** Resolves already-extracted temporal intent; deliberately not a natural-language parser. */
export function resolveCalendar(expression: CalendarExpression, capturedAt: string, zone: string): CalendarResolution {
  assert(Number.isFinite(Date.parse(capturedAt)), 'INVALID_DATE', 'Captura inválida.');
  const clock = localClock(capturedAt, zone);
  const date = new Date(`${clock.date}T00:00:00Z`);
  const addDays = (days: number) => new Date(date.getTime() + days * 86400000).toISOString().slice(0, 10);
  if (expression.kind === 'TODAY') return {date: clock.date, time: null};
  if (expression.kind === 'DAY_OFFSET') {
    assert(Number.isInteger(expression.days) && expression.days >= 0, 'INVALID_DATE', 'Desplazamiento inválido.');
    return {date: addDays(expression.days), time: null};
  }
  if (expression.kind === 'MINUTE_OFFSET') {
    assert(Number.isInteger(expression.minutes) && expression.minutes >= 0, 'INVALID_TIME', 'Desplazamiento inválido.');
    const resolved = localClock(new Date(Date.parse(capturedAt) + expression.minutes * 60000).toISOString(), zone);
    return {date: resolved.date, time: resolved.time};
  }
  const todayWeekday = (date.getUTCDay() + 6) % 7; // Monday = 0.
  const nextMondayOffset = 7 - todayWeekday;
  if (expression.kind === 'NEXT_WEEK') return {start: addDays(nextMondayOffset), end: addDays(nextMondayOffset + 6)};
  if (expression.kind === 'WEEKDAY' || expression.kind === 'NEXT_WEEK_WEEKDAY') {
    assert(Number.isInteger(expression.weekday) && expression.weekday >= 0 && expression.weekday <= 6, 'INVALID_DATE', 'Día semanal inválido.');
    const offset = expression.kind === 'WEEKDAY' ? ((expression.weekday - todayWeekday + 7) % 7 || 7) : nextMondayOffset + expression.weekday;
    return {date: addDays(offset), time: null};
  }
  assert(Number.isInteger(expression.day) && expression.day >= 1 && expression.day <= 31, 'INVALID_DATE', 'Día de mes inválido.');
  for (let months = 0; months < 24; months++) {
    const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
    const candidate = `${month.toISOString().slice(0, 7)}-${String(expression.day).padStart(2, '0')}`;
    if (validDate(candidate) && candidate > clock.date) return {date: candidate, time: null};
  }
  throw new Error('No se encontró fecha válida.');
}
