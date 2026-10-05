import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers';
import {SyncEngine} from '../frontend/src/modules/sync/public';
import {MockSyncTransport} from '../backend/src/modules/sync/public';

test('Push/Pull mock: replicar creación, edición y tombstone; ack outbox', async t => {
  const a = await fixture(), b = await fixture('user', 'other'); t.after(() => {a.uow.close(); b.uow.close();});
  const transport = new MockSyncTransport(), syncA = new SyncEngine(a.uow, a.runtime, transport), syncB = new SyncEngine(b.uow, b.runtime, transport);
  const activity = await a.kernel.create({title: 'A', category: 'WORK', type: 'TASK'});
  await a.kernel.update(activity.id, {title: 'B'}); await syncA.synchronize(); await syncB.pull();
  assert.equal((await b.kernel.pending())[0]?.title, 'B');
  assert.ok((await a.uow.read(r => r.outbox.list())).every(op => op.state === 'ACKNOWLEDGED'));
  await a.kernel.finish(activity.id, 'DELETE'); await syncA.synchronize(); await syncB.pull();
  assert.equal((await b.kernel.pending()).length, 0);
  assert.ok((await b.uow.read(r => r.activities.get(activity.id)))?.deletedAt);
});
test('Idempotencia tras perder respuesta: reintentar sin duplicar feed', async t => {
  const f = await fixture(); t.after(() => f.uow.close()); const transport = new MockSyncTransport();
  await f.kernel.create({title: 'A', category: 'WORK', type: 'TASK'});
  const outbox = await f.uow.read(r => r.outbox.list()); const batchId = outbox[0]!.batchId;
  const first = await transport.push('user', batchId, outbox), second = await transport.push('user', batchId, outbox);
  assert.deepEqual(first, second); assert.equal((await transport.pull('user', 0)).entries.length, 1);
});
test('Dos ediciones offline: conflicto, mantener datos locales y outbox', async t => {
  const a = await fixture(), b = await fixture('user', 'other'); t.after(() => {a.uow.close(); b.uow.close();});
  const transport = new MockSyncTransport(), syncA = new SyncEngine(a.uow, a.runtime, transport), syncB = new SyncEngine(b.uow, b.runtime, transport);
  const activity = await a.kernel.create({title: 'Base', category: 'WORK', type: 'TASK'});
  await syncA.synchronize(); await syncB.pull();
  await a.kernel.update(activity.id, {title: 'Cambio A'}); await b.kernel.update(activity.id, {title: 'Cambio B'});
  await syncA.synchronize(); await syncB.synchronize();
  assert.equal((await b.kernel.pending())[0]?.title, 'Cambio B');
  assert.equal((await b.uow.read(r => r.outbox.list()))[0]?.state, 'CONFLICT');
  const conflict = (await b.uow.read(r => r.syncConflicts.list()))[0]!;
  assert.equal('title' in conflict.local ? conflict.local.title : '', 'Cambio B');
  assert.equal('title' in conflict.remote ? conflict.remote.title : '', 'Cambio A');
});
test('Sesiones de dispositivos offline: preservar intervalos, marcar conflicto y total null', async t => {
  const a = await fixture(), b = await fixture('user', 'other'); t.after(() => {a.uow.close(); b.uow.close();});
  const transport = new MockSyncTransport(), syncA = new SyncEngine(a.uow, a.runtime, transport), syncB = new SyncEngine(b.uow, b.runtime, transport);
  const activity = await a.kernel.create({title: 'Trabajo', category: 'WORK', type: 'TASK'});
  await syncA.synchronize(); await syncB.pull();
  const sa = await a.kernel.start(activity.id); b.setTime('2026-10-03T15:30:00Z'); const sb = await b.kernel.start(activity.id);
  a.setTime('2026-10-03T16:00:00Z'); b.setTime('2026-10-03T16:30:00Z');
  await a.kernel.stop(sa.id); await b.kernel.stop(sb.id);
  await syncA.synchronize(); await syncB.synchronize(); await syncA.pull();
  assert.equal((await a.uow.read(r => r.intervals.list())).length, 2);
  assert.equal((await a.kernel.time(activity.id)).milliseconds, null);
  assert.equal((await b.kernel.time(activity.id)).conflicts.length, 1);
});
test('Error de red no reconoce outbox; respuesta de pull inválida no avanza cursor', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  await f.kernel.create({title: 'A', category: 'WORK', type: 'TASK'});
  const transport = {push: async () => {throw new Error('offline');}, pull: async () => ({entries: [], nextCursor: -1})};
  const engine = new SyncEngine(f.uow, f.runtime, transport);
  await assert.rejects(engine.push(), /offline/);
  assert.equal((await f.uow.read(r => r.outbox.list()))[0]?.state, 'PENDING');
  await assert.rejects(engine.pull(), {code: 'INVALID_SYNC'});
  assert.equal(await f.uow.read(r => r.metadata.get('user')), undefined);
});
test('Usuarios aislados: feed y repositorios locales no exponen pendientes ajenos', async t => {
  const f = await fixture('one'); t.after(() => f.uow.close()); const transport = new MockSyncTransport();
  await f.kernel.create({title: 'Privada', category: 'PERSONAL', type: 'TASK'});
  await new SyncEngine(f.uow, f.runtime, transport).synchronize();
  assert.equal((await transport.pull('two', 0)).entries.length, 0);
});
