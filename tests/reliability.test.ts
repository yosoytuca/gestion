import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {fixture, response} from './helpers';
import {LocalKernel} from '../frontend/src/app/application/local-kernel';
import {IndexedDbUnitOfWork} from '../frontend/src/infrastructure/storage/indexeddb';
import {MockSyncTransport} from '../backend/src/modules/sync/public';
import {CaptureService} from '../frontend/src/modules/capture/public';
import {MockInterpreterProvider} from '../backend/src/modules/interpreter/public';
import {MockVoiceProvider} from '../backend/src/modules/voice/public';
import type {InterpreterInput} from '../datos/contracts/interpreter/public';

test('Fallo al escribir outbox revierte modificación y auditoría', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  const kernel = new LocalKernel({close: () => f.uow.close(), read: work => f.uow.read(work),
    write: work => f.uow.write(r => work({...r, outbox: {...r.outbox, get: id => r.outbox.get(id),
      list: () => r.outbox.list(), put: async () => {throw new Error('cuota outbox');}}}))}, f.runtime);
  await assert.rejects(kernel.create({title: 'A', category: 'WORK', type: 'TASK'}), /cuota outbox/);
  assert.equal((await f.uow.read(r => r.activities.list())).length, 0);
  assert.equal((await f.uow.read(r => r.changes.list())).length, 0);
});
test('Actualizar IndexedDB v1 a v2 conserva registros existentes', async t => {
  const factory = new IDBFactory(), name = crypto.randomUUID();
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = factory.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('activities', {keyPath: 'id'});
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('activities', 'readwrite');
    tx.objectStore('activities').put({id: 'legacy', userId: 'user', title: 'Conservar'});
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
  db.close(); const uow = await IndexedDbUnitOfWork.open(name, factory); t.after(() => uow.close());
  assert.equal((await uow.read(r => r.activities.get('legacy')))?.title, 'Conservar');
  assert.deepEqual(await uow.read(r => r.syncConflicts.list()), []);
});
test('Sync mock rechaza lote completo si una operación tiene base incompatible', async t => {
  const f = await fixture(); t.after(() => f.uow.close());
  await f.kernel.createGroup('Grupo');
  await f.kernel.create({title: 'A', category: 'WORK', type: 'TASK'});
  const batchId = crypto.randomUUID();
  const operations = (await f.uow.read(r => r.outbox.list())).map(op => ({...op, batchId}));
  const activity = operations.find(op => op.entityType === 'activity')!;
  activity.baseVersion = 1; activity.payload.version = 2;
  const transport = new MockSyncTransport();
  assert.equal((await transport.push('user', batchId, operations)).conflict, true);
  assert.equal((await transport.pull('user', 0)).entries.length, 0);
});
test('Capture rechaza inputId y contexto incoherente de proveedores', async () => {
  const r = response(); const capture = new CaptureService(new MockInterpreterProvider(r), new MockVoiceProvider('texto'));
  const input: InterpreterInput = {inputId: crypto.randomUUID(), text: 'Texto', capturedAt: '2026-10-03T15:00:00Z',
    localDate: '2026-10-03', localTime: '10:00:00', timeZone: 'America/Bogota', candidates: []};
  await assert.rejects(capture.text(input), {code: 'INVALID_CAPTURE'});
  input.inputId = r.inputId; input.localDate = '2026-10-04';
  await assert.rejects(capture.text(input), {code: 'INVALID_CAPTURE'});
});
