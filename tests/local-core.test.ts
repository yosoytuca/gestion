import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers';
import {effectiveStatus, localClock, temporalBucket, validDate} from '../datos/domain/activities/public';
import {activeMilliseconds, detectOverlaps} from '../datos/domain/sessions/public';

test('CREATE → UPDATE → reprogramar → COMPLETE → historial + auditoría/outbox; conservar fecha calendario', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const a = await f.kernel.create({title: ' Acrílicos ', category: 'WORK', type: 'TASK', dueDate: '2026-10-10'});
  assert.equal(a.title, 'Acrílicos'); assert.equal(a.dueDate, '2026-10-10'); assert.equal(a.dueTime, null);
  const b = await f.kernel.update(a.id, {dueDate: '2026-10-04', dueTime: '16:30', category: 'EDUCATION'}, a.version);
  assert.equal(b.version, 2); assert.equal((await f.kernel.pending())[0]?.id, a.id);
  f.setTime('2026-10-04T22:00:00Z');
  await f.kernel.finish(a.id, 'COMPLETE', b.version);
  assert.equal((await f.kernel.pending()).length, 0);
  assert.equal((await f.kernel.history({query: 'acrilicos', category: 'EDUCATION', from: '2026-10-04', to: '2026-10-04'})).length, 1);
  assert.equal((await f.kernel.history({status: 'CANCELLED'})).length, 0);
  const snapshot = await f.uow.read(async r => ({changes: await r.changes.list(), outbox: await r.outbox.list()}));
  assert.equal(snapshot.changes.length, 3); assert.equal(snapshot.outbox.length, 3);
  assert.equal(snapshot.changes.find(c => c.action === 'UPDATE')?.previousValues?.dueDate, '2026-10-10');
});
test('Cancelar conserva historial; DELETE conserva tombstone y no aparece en historial', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const a = await f.kernel.create({title: 'Cita', category: 'HEALTH', type: 'COMMITMENT'});
  await f.kernel.finish(a.id, 'CANCEL'); assert.equal((await f.kernel.history())[0]?.status, 'CANCELLED');
  await f.kernel.finish(a.id, 'DELETE'); assert.equal((await f.kernel.history()).length, 0);
  assert.ok((await f.uow.read(r => r.activities.get(a.id)))?.deletedAt);
  await assert.rejects(f.kernel.update(a.id, {title: 'Resucitar'}), {code: 'DELETED_TARGET'});
});
test('Validaciones de campos, fechas, categoría, tipo y versión antes de persistir', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  for (const patch of [{title: ''}, {dueDate: '2026-02-30'}, {dueTime: '16:00'}, {dueDate: '2026-10-03', dueTime: '25:00'},
    {category: 'work'}, {type: 'EVENT'}]) {
    await assert.rejects(f.kernel.create({title: 'Test', category: 'WORK', type: 'TASK', ...patch} as never));
  }
  assert.equal((await f.uow.read(r => r.outbox.list())).length, 0);
  const a = await f.kernel.create({title: 'Test', category: 'WORK', type: 'TASK'});
  await assert.rejects(f.kernel.update(a.id, {title: 'Error'}, 9), {code: 'STALE_TARGET'});
  await assert.rejects(f.kernel.update(a.id, {status: 'COMPLETED'} as never), {code: 'INVALID_PATCH'});
  await assert.rejects(f.kernel.update(a.id, {}), {code: 'INVALID_PATCH'});
});
test('Atomicidad IndexedDB: error después de escribir revierte entidades y outbox', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  await assert.rejects(f.kernel.command('manual', async (_r, c) => {
    const a = {id: c.id(), userId: c.userId, title: 'Grupo', deletedAt: null, createdAt: c.now(), updatedAt: c.now(), version: 1};
    await c.save('group', a, 'CREATE', null); throw new Error('fallo deliberado');
  }), /fallo deliberado/);
  assert.equal((await f.uow.read(r => r.groups.list())).length, 0);
  assert.equal((await f.uow.read(r => r.outbox.list())).length, 0);
});
test('Orden puro: vencidas, hoy con hora, hoy sin hora, próximas, futuras, sin fecha', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const input = {category: 'WORK', type: 'TASK'} as const;
  for (const [title, dueDate, dueTime] of [
    ['Sin fecha', null, null], ['Futura', '2026-11-01', null], ['Hoy sin hora', '2026-10-03', null],
    ['16', '2026-10-03', '16:00'], ['11', '2026-10-03', '11:00'], ['Vencida', '2026-10-03', '09:00'],
    ['Próxima', '2026-10-04', null]
  ] as const) await f.kernel.create({...input, title, dueDate, dueTime});
  assert.deepEqual((await f.kernel.pending()).map(a => a.title), ['Vencida', '11', '16', 'Hoy sin hora', 'Próxima', 'Futura', 'Sin fecha']);
  assert.equal((await f.kernel.pending()).find(a => a.title === 'Vencida')?.status, 'PENDING');
  f.setTime('2026-10-04T05:01:00Z');
  const today = (await f.kernel.pending()).find(a => a.title === 'Hoy sin hora')!;
  assert.equal(temporalBucket(today, localClock(f.runtime.now(), f.runtime.timeZone)), 'OVERDUE');
});
test('Desempate createdAt y edición temporal inmediata', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const a = await f.kernel.create({title: 'Primera', category: 'WORK', type: 'TASK', dueDate: '2026-10-20'});
  f.setTime('2026-10-03T15:01:00Z');
  const b = await f.kernel.create({title: 'Segunda', category: 'WORK', type: 'TASK', dueDate: '2026-10-20'});
  assert.deepEqual((await f.kernel.pending()).map(a => a.id), [a.id, b.id]);
  await f.kernel.update(b.id, {dueDate: '2026-10-04'});
  assert.equal((await f.kernel.pending())[0]?.id, b.id);
});
test('Fechas reales, año bisiesto y zona sin conversión de fecha calendario', () => {
  assert.equal(validDate('2028-02-29'), true); assert.equal(validDate('2026-02-29'), false);
  assert.equal(localClock('2026-10-04T02:00:00Z', 'America/Bogota').date, '2026-10-03');
});
test('Grupos con fechas distintas y progreso sin contar canceladas como completadas', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const group = await f.kernel.createGroup('Cotizaciones');
  const children = [];
  for (let i = 0; i < 4; i++) children.push(await f.kernel.create({title: `Hijo ${i}`, category: 'WORK', type: 'TASK', groupId: group.id, dueDate: `2026-10-0${i + 3}`}));
  await f.kernel.finish(children[0]!.id, 'COMPLETE'); await f.kernel.finish(children[1]!.id, 'COMPLETE');
  await f.kernel.finish(children[3]!.id, 'CANCEL');
  assert.deepEqual(await f.kernel.groupProgress(group.id), {total: 4, completed: 2, pending: 1, cancelled: 1});
  await assert.rejects(f.kernel.create({title: 'Error', category: 'WORK', type: 'TASK', groupId: 'missing'}), {code: 'INVALID_GROUP'});
});
test('Timer 40 + 35 minutos, pausa no cuenta, STOP no COMPLETE', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const a = await f.kernel.create({title: 'Trabajo', category: 'WORK', type: 'TASK'});
  const s = await f.kernel.start(a.id);
  f.setTime('2026-10-03T15:40:00Z'); await f.kernel.pause(s.id);
  f.setTime('2026-10-03T15:55:00Z'); await f.kernel.resume(s.id);
  f.setTime('2026-10-03T16:30:00Z'); await f.kernel.stop(s.id);
  assert.equal((await f.kernel.time(a.id)).milliseconds, 75 * 60000);
  const sessions = await f.uow.read(r => r.sessions.list());
  assert.equal(effectiveStatus((await f.kernel.pending())[0]!, sessions), 'PENDING');
  assert.equal((await f.kernel.history()).length, 0);
  await assert.rejects(f.kernel.resume(s.id), {code: 'INVALID_TRANSITION'});
});
test('Iniciar otra pausa anterior desde dominio; IN_PROGRESS es estado efectivo', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const a = await f.kernel.create({title: 'A', category: 'WORK', type: 'TASK'});
  const b = await f.kernel.create({title: 'B', category: 'WORK', type: 'TASK'});
  const first = await f.kernel.start(a.id);
  f.setTime('2026-10-03T15:10:00Z'); await f.kernel.start(b.id);
  const sessions = await f.uow.read(r => r.sessions.list());
  assert.equal(sessions.find(s => s.id === first.id)?.state, 'PAUSED');
  assert.equal(sessions.filter(s => s.state === 'RUNNING').length, 1);
  assert.equal(effectiveStatus(b, sessions), 'IN_PROGRESS');
  assert.equal((await f.kernel.time(a.id)).milliseconds, 600000);
});
test('Completar cierra sesión e intervalos; no iniciar compromisos o terminales', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const a = await f.kernel.create({title: 'A', category: 'WORK', type: 'TASK'});
  const s = await f.kernel.start(a.id); f.setTime('2026-10-03T15:10:00Z'); await f.kernel.finish(a.id, 'COMPLETE');
  assert.equal((await f.uow.read(r => r.sessions.get(s.id)))?.state, 'STOPPED');
  assert.equal((await f.kernel.time(a.id)).milliseconds, 600000);
  await assert.rejects(f.kernel.start(a.id), {code: 'NOT_WORKABLE'});
  const c = await f.kernel.create({title: 'Cita', category: 'HEALTH', type: 'COMMITMENT'});
  await assert.rejects(f.kernel.start(c.id), {code: 'NOT_WORKABLE'});
});
test('Reapertura conserva entidades, outbox y contador basado en timestamps', async t => {
  const f = await fixture();
  const a = await f.kernel.create({title: 'Persistente', category: 'WORK', type: 'TASK'});
  await f.kernel.start(a.id); f.uow.close();
  const reopened = await fixture('user', 'device', f.factory, f.name); t.after(() => reopened.uow.close());
  reopened.setTime('2026-10-03T16:00:00Z');
  assert.equal((await reopened.kernel.pending()).length, 1);
  assert.equal((await reopened.kernel.time(a.id, true)).milliseconds, 3600000);
  assert.ok((await reopened.uow.read(r => r.outbox.list())).length > 0);
});
test('Dos conexiones/pestañas serializan START y conservan una sola sesión local activa', async t => {
  const f = await fixture(); const other = await fixture('user', 'device', f.factory, f.name);
  t.after(() => {f.uow.close(); other.uow.close();});
  const a = await f.kernel.create({title: 'A', category: 'WORK', type: 'TASK'});
  const b = await f.kernel.create({title: 'B', category: 'WORK', type: 'TASK'});
  await Promise.all([f.kernel.start(a.id), other.kernel.start(b.id)]);
  assert.equal((await f.uow.read(r => r.sessions.list())).filter(s => s.state === 'RUNNING').length, 1);
});
test('Reloj retrocede: PAUSE aborta sin perder intervalo ni outbox', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const a = await f.kernel.create({title: 'A', category: 'WORK', type: 'TASK'}); const s = await f.kernel.start(a.id);
  const count = (await f.uow.read(r => r.outbox.list())).length;
  f.setTime('2026-10-03T14:00:00Z'); await assert.rejects(f.kernel.pause(s.id), {code: 'CLOCK_ERROR'});
  assert.equal((await f.uow.read(r => r.sessions.get(s.id)))?.state, 'RUNNING');
  assert.equal((await f.uow.read(r => r.outbox.list())).length, count);
});
test('Cambio de tipo con sesión abierta se rechaza; borrar cierra sesión', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const a = await f.kernel.create({title: 'A', category: 'WORK', type: 'TASK'}); const s = await f.kernel.start(a.id);
  await assert.rejects(f.kernel.update(a.id, {type: 'COMMITMENT'}), {code: 'SESSION_EXISTS'});
  await f.kernel.finish(a.id, 'DELETE');
  assert.equal((await f.uow.read(r => r.sessions.get(s.id)))?.state, 'STOPPED');
});
test('Conflictos de intervalos inter-dispositivo: detectar, no sumar total definitivo', () => {
  const base = {userId: 'u', activityId: 'a', sessionId: 's', createdAt: '2026-10-03T15:00:00Z', updatedAt: '2026-10-03T15:00:00Z', version: 1};
  const intervals = [{...base, id: '1', deviceId: 'a', startedAt: '2026-10-03T15:00:00Z', endedAt: '2026-10-03T16:00:00Z'},
    {...base, id: '2', deviceId: 'b', startedAt: '2026-10-03T15:30:00Z', endedAt: '2026-10-03T16:30:00Z'}];
  assert.equal(detectOverlaps(intervals, '2026-10-03T17:00:00Z').length, 1);
  assert.equal(activeMilliseconds(intervals), 7200000);
  intervals[1]!.startedAt = '2026-10-03T16:00:00Z';
  assert.equal(detectOverlaps(intervals, '2026-10-03T17:00:00Z').length, 0);
});
