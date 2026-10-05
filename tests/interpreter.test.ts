import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture, response} from './helpers';
import {InterpreterWorkflow} from '../frontend/src/app/application/interpreter-workflow';
import {validateInterpreter} from '../datos/contracts/interpreter/validation';
import {CaptureService} from '../frontend/src/modules/capture/public';
import {MockInterpreterProvider} from '../backend/src/modules/interpreter/public';
import {MockVoiceProvider} from '../backend/src/modules/voice/public';

test('JSON schema runtime: v1.1 válida; rechazar versión, enum, campos extra y fecha imposible', () => {
  assert.equal(validateInterpreter(response()).operations.length, 1);
  for (const mutate of [
    (r: any) => {r.schemaVersion = '1.0';},
    (r: any) => {r.operations[0].fields.category = 'work';},
    (r: any) => {r.operations[0].fields.extra = true;},
    (r: any) => {r.operations[0].fields.dueDate = '2026-02-30';},
    (r: any) => {r.operations[0].fields.dueTime = '25:00';},
    (r: any) => {r.operations[0].fields.dueDate = null; r.operations[0].fields.dueTime = '16:00';},
    (r: any) => {r.operations.push(structuredClone(r.operations[0]));}
  ]) {const r = response(); mutate(r); assert.throws(() => validateInterpreter(r));}
});
test('Preparar no ejecuta; aplicar clara crea actividad, auditoría y outbox; reintento no duplica', async t => {
  const f = await fixture(); t.after(() => f.uow.close()); const workflow = new InterpreterWorkflow(f.kernel);
  const r = response(), batch = await workflow.prepare(r);
  assert.equal((await f.kernel.pending()).length, 0);
  const applied = await workflow.applyPrepared(batch.id, batch.revision);
  assert.equal(applied.state, 'APPLIED'); assert.equal((await f.kernel.pending()).length, 1);
  await workflow.applyPrepared(applied.id, applied.revision);
  assert.equal((await f.kernel.pending()).length, 1);
  assert.equal((await f.uow.read(r => r.outbox.list())).length, 1);
});
test('Lote mixto: clara aplicable, ambigua bloqueada, resolución posterior sin duplicados', async t => {
  const f = await fixture(); t.after(() => f.uow.close()); const workflow = new InterpreterWorkflow(f.kernel);
  const r = response();
  r.operations.push({opId: 'doctor', action: 'CREATE', evidence: 'Mañana médico a las cuatro', fields: {
    title: 'Médico', category: 'HEALTH', type: 'COMMITMENT', dueDate: '2026-10-04', dueTime: null, reservedDurationMinutes: null, groupRef: null}});
  r.clarifications.push({id: 'time', reason: 'AMBIGUOUS_TIME', question: '¿04:00 o 16:00?', expression: 'a las cuatro',
    affectedOpIds: ['doctor'], candidateIds: [], options: ['04:00', '16:00'], dateRange: null});
  const batch = await workflow.prepare(r);
  assert.deepEqual(batch.preparedOpIds, ['create-1']); assert.deepEqual(batch.blockedOpIds, ['doctor']);
  const partial = await workflow.applyPrepared(batch.id, batch.revision);
  assert.equal(partial.state, 'PARTIAL'); assert.equal((await f.kernel.pending()).length, 1);
  r.clarifications = []; const doctor = r.operations[1]!; if (doctor.action === 'CREATE') doctor.fields.dueTime = '16:00';
  const resolved = await workflow.prepare(r);
  await workflow.applyPrepared(resolved.id, resolved.revision);
  assert.equal((await f.kernel.pending()).length, 2);
  assert.equal((await f.kernel.pending()).find(a => a.category === 'HEALTH')?.dueTime, '16:00');
  assert.deepEqual(partial.appliedOpIds, ['create-1']);
});
test('Modificación ambigua no ejecuta: candidatos múltiples y borrador compartido', async t => {
  const f = await fixture(); t.after(() => f.uow.close()); const workflow = new InterpreterWorkflow(f.kernel);
  const a = await f.kernel.create({title: 'Reunión', category: 'EDUCATION', type: 'COMMITMENT', dueDate: '2026-10-10'});
  const r = response();
  r.operations.push({opId: 'move', action: 'UPDATE', targetId: a.id, expectedVersion: a.version, evidence: 'cambia reunión', patch: {dueDate: '2026-10-04'}});
  r.clarifications.push({id: 'which', reason: 'AMBIGUOUS_TARGET', question: '¿Cuál reunión?', expression: 'reunión',
    affectedOpIds: ['move'], candidateIds: [a.id], options: [], dateRange: null});
  const batch = await workflow.prepare(r, [{id: a.id, version: a.version}]);
  await workflow.applyPrepared(batch.id, batch.revision);
  assert.equal((await f.uow.read(r => r.activities.get(a.id)))?.dueDate, '2026-10-10');
});
test('CREATE_GROUP y múltiples CREATE conservan relación y fechas individuales', async t => {
  const f = await fixture(); t.after(() => f.uow.close()); const workflow = new InterpreterWorkflow(f.kernel);
  const r = response(); const create = r.operations[0]!;
  if (create.action === 'CREATE') create.fields.groupRef = 'quotes';
  r.operations.push({opId: 'group', action: 'CREATE_GROUP', tempId: 'quotes', title: 'Cotizaciones', evidence: 'Cotizaciones'});
  const batch = await workflow.prepare(r); await workflow.applyPrepared(batch.id, batch.revision);
  const group = (await f.uow.read(r => r.groups.list()))[0]!;
  assert.equal((await f.kernel.pending())[0]?.groupId, group.id);
});
test('UPDATE solo modifica patch; COMPLETE, CANCEL y DELETE por servicios de dominio', async t => {
  const f = await fixture(); t.after(() => f.uow.close()); const workflow = new InterpreterWorkflow(f.kernel);
  for (const action of ['UPDATE', 'COMPLETE', 'CANCEL', 'DELETE'] as const) {
    const a = await f.kernel.create({title: action, category: 'HEALTH', type: 'COMMITMENT', dueDate: '2026-10-04', dueTime: '16:00'});
    const r = response(); r.operations = [{opId: 'modify', action, targetId: a.id, expectedVersion: 1, evidence: 'orden',
      ...(action === 'UPDATE' ? {patch: {dueTime: '17:00'}} : {})} as never];
    const b = await workflow.prepare(r, [{id: a.id, version: 1}]); await workflow.applyPrepared(b.id, b.revision);
    const updated = (await f.uow.read(r => r.activities.get(a.id)))!;
    assert.equal(updated.category, 'HEALTH');
    if (action === 'UPDATE') {assert.equal(updated.dueTime, '17:00'); assert.equal(updated.dueDate, '2026-10-04');}
    if (action === 'COMPLETE') assert.equal(updated.status, 'COMPLETED');
    if (action === 'CANCEL') assert.equal(updated.status, 'CANCELLED');
    if (action === 'DELETE') assert.ok(updated.deletedAt);
  }
});
test('Versiones se revalidan al aplicar; fallo revierte también creaciones del lote', async t => {
  const f = await fixture(); t.after(() => f.uow.close()); const workflow = new InterpreterWorkflow(f.kernel);
  const a = await f.kernel.create({title: 'A', category: 'WORK', type: 'TASK'});
  const r = response(); r.operations.push({opId: 'update', action: 'UPDATE', targetId: a.id, expectedVersion: 1, patch: {title: 'B'}, evidence: 'cambia'});
  const b = await workflow.prepare(r, [{id: a.id, version: 1}]); await f.kernel.update(a.id, {title: 'Manual'});
  await assert.rejects(workflow.applyPrepared(b.id, b.revision), {code: 'STALE_TARGET'});
  assert.equal((await f.kernel.pending()).length, 1);
  assert.equal((await f.uow.read(r => r.batches.get(b.id)))?.appliedOpIds.length, 0);
});
test('Rechazar objetivos no candidatos y modificaciones de operación ya aplicada', async t => {
  const f = await fixture(); t.after(() => f.uow.close()); const workflow = new InterpreterWorkflow(f.kernel);
  const a = await f.kernel.create({title: 'A', category: 'WORK', type: 'TASK'});
  const invalid = response(); invalid.operations = [{opId: 'bad', action: 'DELETE', targetId: a.id, expectedVersion: 1, evidence: 'borra'}];
  await assert.rejects(workflow.prepare(invalid), {code: 'UNAUTHORIZED_TARGET'});
  const r = response(), b = await workflow.prepare(r); await workflow.applyPrepared(b.id, b.revision);
  if (r.operations[0]?.action === 'CREATE') r.operations[0].fields.title = 'Cambiada';
  await assert.rejects(workflow.prepare(r), {code: 'APPLIED_OPERATION_CHANGED'});
});
test('Aclaración sin operación mantiene lote parcial; referencia inválida rechazada', async t => {
  const f = await fixture(); t.after(() => f.uow.close()); const workflow = new InterpreterWorkflow(f.kernel);
  const r = response(); r.clarifications = [{id: 'missing', reason: 'MISSING_TARGET', question: '¿Cuál?', expression: 'la reunión',
    affectedOpIds: [], candidateIds: [], options: [], dateRange: null}];
  const b = await workflow.prepare(r), applied = await workflow.applyPrepared(b.id, b.revision);
  assert.equal(applied.state, 'PARTIAL');
  r.clarifications[0]!.affectedOpIds = ['nonexistent']; assert.throws(() => validateInterpreter(r));
});
test('Voice mock → mismo intérprete que texto; contexto capturado no se cambia', async () => {
  const r = response();
  const capture = new CaptureService(new MockInterpreterProvider(r), new MockVoiceProvider('Hoy cotización'));
  const input = {inputId: r.inputId, text: 'Hoy cotización', capturedAt: '2026-10-03T15:00:00Z',
    localDate: '2026-10-03', localTime: '10:00:00', timeZone: 'America/Bogota', candidates: []};
  assert.deepEqual(await capture.text(input), await capture.audio({audio: new Blob(['mock']), context: input}, []));
});
