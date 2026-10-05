import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveCalendar} from '../datos/domain/activities/calendar';
const zone = 'America/Bogota';
test('Reglas aprobadas: lunes futuro, lunes de próxima semana y hoy explícito', () => {
  assert.deepEqual(resolveCalendar({kind: 'WEEKDAY', weekday: 0}, '2026-10-05T15:00:00Z', zone), {date: '2026-10-12', time: null});
  assert.deepEqual(resolveCalendar({kind: 'TODAY'}, '2026-10-05T15:00:00Z', zone), {date: '2026-10-05', time: null});
  assert.deepEqual(resolveCalendar({kind: 'NEXT_WEEK_WEEKDAY', weekday: 0}, '2026-10-03T15:00:00Z', zone), {date: '2026-10-05', time: null});
  assert.deepEqual(resolveCalendar({kind: 'NEXT_WEEK_WEEKDAY', weekday: 0}, '2026-10-06T15:00:00Z', zone), {date: '2026-10-12', time: null});
});
test('Día 10 estrictamente futuro; meses cortos y cambio de año', () => {
  assert.deepEqual(resolveCalendar({kind: 'DAY_OF_MONTH', day: 10}, '2026-10-10T15:00:00Z', zone), {date: '2026-11-10', time: null});
  assert.deepEqual(resolveCalendar({kind: 'DAY_OF_MONTH', day: 31}, '2026-02-01T15:00:00Z', zone), {date: '2026-03-31', time: null});
  assert.deepEqual(resolveCalendar({kind: 'DAY_OFFSET', days: 1}, '2026-12-31T15:00:00Z', zone), {date: '2027-01-01', time: null});
});
test('Próxima semana conserva rango; dentro de una hora cruza medianoche local', () => {
  assert.deepEqual(resolveCalendar({kind: 'NEXT_WEEK'}, '2026-10-03T15:00:00Z', zone), {start: '2026-10-05', end: '2026-10-11'});
  assert.deepEqual(resolveCalendar({kind: 'MINUTE_OFFSET', minutes: 60}, '2026-10-04T04:30:00Z', zone), {date: '2026-10-04', time: '00:30'});
});
test('Rechazar días, desplazamientos y capturas inválidos', () => {
  assert.throws(() => resolveCalendar({kind: 'DAY_OF_MONTH', day: 32}, '2026-10-03T15:00:00Z', zone));
  assert.throws(() => resolveCalendar({kind: 'WEEKDAY', weekday: -1}, '2026-10-03T15:00:00Z', zone));
  assert.throws(() => resolveCalendar({kind: 'MINUTE_OFFSET', minutes: -1}, '2026-10-03T15:00:00Z', zone));
  assert.throws(() => resolveCalendar({kind: 'TODAY'}, 'invalid', zone));
});
