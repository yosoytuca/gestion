import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture, response} from './helpers';
import {LocalKernel} from '../frontend/src/app/application/local-kernel';
import {seedDemo} from '../frontend/src/app/application/demo-data';
import {exportBackup, restoreBackup, validateBackup} from '../frontend/src/app/application/backup';
import {InterpreterWorkflow} from '../frontend/src/app/application/interpreter-workflow';
import {prepareApplication} from '../frontend/src/app/initialization/prepare';
import {composeServices} from '../frontend/src/app/initialization/services';

test('Demo atómica: fallo de escritura revierte todo y reintento no duplica', async t => {
  const f = await fixture('demo'); t.after(() => f.uow.close());
  let writes = 0;
  const failing = new LocalKernel({close() {}, read: work => f.uow.read(work), write: work => f.uow.write(r => work({...r,
    outbox: {...r.outbox, get: id => r.outbox.get(id), list: () => r.outbox.list(), put: async record => {
      if (++writes === 5) throw new Error('Sin espacio'); await r.outbox.put(record);
    }}}))}, f.runtime);
  await assert.rejects(seedDemo(failing), /Sin espacio/);
  assert.deepEqual(await f.uow.read(async r => [await r.activities.list(), await r.groups.list(), await r.outbox.list()]), [[], [], []]);
  await seedDemo(f.kernel); const count = (await f.uow.read(r => r.activities.list())).length;
  await seedDemo(f.kernel); assert.equal((await f.uow.read(r => r.activities.list())).length, count);
});

test('Respaldo completo conserva grupos, historia, timer, tombstones, lotes y outbox', async t => {
  const source = await fixture(), target = await fixture(); t.after(() => {source.uow.close(); target.uow.close();});
  const group = await source.kernel.createGroup('Grupo');
  const a = await source.kernel.create({title: 'Conservar', category: 'WORK', type: 'TASK', groupId: group.id});
  const session = await source.kernel.start(a.id); source.setTime('2026-10-03T15:01:00Z'); await source.kernel.pause(session.id);
  const deleted = await source.kernel.create({title: 'Error', category: 'HEALTH', type: 'COMMITMENT'}); await source.kernel.finish(deleted.id, 'DELETE');
  const workflow = new InterpreterWorkflow(source.kernel); const batch = await workflow.prepare(response()); await workflow.applyPrepared(batch.id, batch.revision);
  const text = await exportBackup(source.uow, source.runtime);
  const result = await restoreBackup(target.uow, target.runtime, text); assert.equal(result.count, 2);
  assert.equal(await exportBackup(target.uow, {...target.runtime, now: source.runtime.now}), text);
  assert.equal((await target.kernel.time(a.id)).milliseconds, 60000);
});

test('Respaldo rechaza versión, usuario, campos y referencias inválidos sin guardar', async t => {
  const source = await fixture(), target = await fixture(); t.after(() => {source.uow.close(); target.uow.close();});
  await source.kernel.create({title: 'A', category: 'WORK', type: 'TASK'});
  const text = await exportBackup(source.uow, source.runtime);
  for (const mutate of [(b: any) => {b.version = 2;}, (b: any) => {b.userId = 'otro';},
    (b: any) => {b.stores.activities[0].dueTime = '25:00';}, (b: any) => {b.stores.activities[0].groupId = 'ausente';},
    (b: any) => {b.stores.activities.push(b.stores.activities[0]);}]) {
    const backup = JSON.parse(text); mutate(backup);
    await assert.rejects(restoreBackup(target.uow, target.runtime, JSON.stringify(backup)));
    assert.equal((await target.kernel.pending()).length, 0);
  }
  assert.throws(() => validateBackup('null', 'user'));
});

test('Restauración no reemplaza datos y revierte todas las colecciones si falla', async t => {
  const source = await fixture(), target = await fixture(); t.after(() => {source.uow.close(); target.uow.close();});
  await source.kernel.create({title: 'A', category: 'WORK', type: 'TASK'}); const text = await exportBackup(source.uow, source.runtime);
  const failing = {close() {}, read: target.uow.read.bind(target.uow), write: <T>(work: Parameters<typeof target.uow.write<T>>[0]) => target.uow.write(r => work({...r,
    outbox: {...r.outbox, get: id => r.outbox.get(id), list: () => r.outbox.list(), put: async () => {throw new Error('Cuota');}}}))};
  await assert.rejects(restoreBackup(failing, target.runtime, text), /Cuota/);
  assert.equal((await target.kernel.pending()).length, 0);
  await target.kernel.create({title: 'Original', category: 'PERSONAL', type: 'TASK'});
  await assert.rejects(restoreBackup(target.uow, target.runtime, text), /espacio vacío/);
  assert.equal((await target.kernel.pending())[0]?.title, 'Original');
});

test('Inicialización respeta pasos, cierra conexión al fallar y admite reintento', async t => {
  const f = await fixture('demo'); t.after(() => f.uow.close());
  const steps: string[] = [], config = {mode: 'demo' as const, deviceId: 'device', databaseName: 'gestor-ui-demo' as const, timeZone: 'America/Bogota'};
  const deps = {configuration: () => config, openStorage: async () => f.uow, composeServices,
    seedDemo: async () => {throw new Error('fallo seed');}};
  await assert.rejects(prepareApplication(step => steps.push(step), deps), /fallo seed/);
  assert.equal(steps.length, 4);
  await assert.rejects(f.uow.read(r => r.activities.list()));
  const reopened = await import('../frontend/src/infrastructure/storage/indexeddb');
  const ready = await prepareApplication(step => steps.push(step), {...deps,
    openStorage: () => reopened.IndexedDbUnitOfWork.open(f.name, f.factory), seedDemo});
  assert.equal((await ready.controller.snapshot()).pending.length, 9); ready.close();
  assert.equal(steps.at(-1), 'Comprobando tus pendientes…');
});
