import {IDBFactory} from 'fake-indexeddb';
import {IndexedDbUnitOfWork} from '../frontend/src/infrastructure/storage/indexeddb';
import {LocalKernel} from '../frontend/src/app/application/local-kernel';
import type {InterpreterBatch} from '../datos/contracts/interpreter/public';
export async function fixture(userId = 'user', deviceId = 'device', factory = new IDBFactory(), name = crypto.randomUUID()) {
  let now = '2026-10-03T15:00:00.000Z';
  const uow = await IndexedDbUnitOfWork.open(name, factory);
  const runtime = {userId, deviceId, timeZone: 'America/Bogota', now: () => now, id: () => crypto.randomUUID()};
  return {kernel: new LocalKernel(uow, runtime), uow, runtime, factory, name, setTime: (value: string) => {now = value;}};
}
export function response(): InterpreterBatch {
  return {schemaVersion: '1.1', inputId: crypto.randomUUID(), operations: [{opId: 'create-1', action: 'CREATE', evidence: 'Hoy cotización',
    fields: {title: 'Cotización', category: 'WORK', type: 'TASK', dueDate: '2026-10-03', dueTime: null,
      reservedDurationMinutes: null, groupRef: null}}], clarifications: []};
}
