import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture, response} from './helpers';
import {InterpreterWorkflow} from '../frontend/src/app/application/interpreter-workflow';
import {SyncEngine} from '../frontend/src/modules/sync/public';
import {MockSyncTransport} from '../backend/src/modules/sync/public';

test('Historial por día local y validación del periodo', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const a = await f.kernel.create({title: 'A', category: 'PERSONAL', type: 'TASK'});
  f.setTime('2026-10-04T02:00:00Z'); await f.kernel.finish(a.id, 'COMPLETE');
  assert.equal((await f.kernel.history({from: '2026-10-03', to: '2026-10-03'})).length, 1);
  assert.equal((await f.kernel.history({from: '2026-10-04'})).length, 0);
  await assert.rejects(f.kernel.history({from: '2026-02-30'}), {code: 'INVALID_PERIOD'});
});
test('Preparar rechaza semántica inválida incluso si JSON schema la admite', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const workflow = new InterpreterWorkflow(f.kernel), r = response();
  if (r.operations[0]?.action === 'CREATE') r.operations[0].fields.reservedDurationMinutes = 30;
  await assert.rejects(workflow.prepare(r), {code: 'INVALID_DURATION'});
  assert.equal((await f.uow.read(r => r.batches.list())).length, 0);
});
test('Repreparar COMPLETE aplicado no necesita candidato vigente ni duplica auditoría', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const a = await f.kernel.create({title: 'A', category: 'WORK', type: 'TASK'}), workflow = new InterpreterWorkflow(f.kernel);
  const r = response(); r.operations = [{opId: 'complete', action: 'COMPLETE', targetId: a.id, expectedVersion: 1, evidence: 'terminé'}];
  const b = await workflow.prepare(r, [{id: a.id, version: 1}]); await workflow.applyPrepared(b.id, b.revision);
  const refreshed = await workflow.prepare(r); assert.equal(refreshed.state, 'APPLIED');
  assert.equal((await f.uow.read(r => r.changes.list())).length, 2);
});
test('Sesión remota conocida impide iniciar otra sin borrar información', async t => {
  const a = await fixture(), b = await fixture('user', 'other'); t.after(() => {a.uow.close(); b.uow.close();});
  const transport = new MockSyncTransport(), syncA = new SyncEngine(a.uow, a.runtime, transport), syncB = new SyncEngine(b.uow, b.runtime, transport);
  const activity = await a.kernel.create({title: 'A', category: 'WORK', type: 'TASK'});
  await a.kernel.start(activity.id); await syncA.synchronize(); await syncB.pull();
  await assert.rejects(b.kernel.start(activity.id), {code: 'REMOTE_SESSION_ACTIVE'});
  assert.equal((await b.uow.read(r => r.sessions.list())).length, 1);
});
test('Push batch de grupo/hijo atómico; creación ilegítima sobre tombstone rechazada', async t => {
  const f = await fixture(); t.after(() => f.uow.close()); const transport = new MockSyncTransport();
  const a = await f.kernel.create({title: 'A', category: 'WORK', type: 'TASK'});
  await f.kernel.finish(a.id, 'DELETE'); await new SyncEngine(f.uow, f.runtime, transport).synchronize();
  const original = (await f.uow.read(r => r.outbox.list())).find(op => op.action === 'CREATE')!;
  const op = {...original, batchId: crypto.randomUUID(), id: crypto.randomUUID(), mutationId: ''}; op.mutationId = op.id;
  const result = await transport.push('user', op.batchId, [op]); assert.equal(result.conflict, true);
});
