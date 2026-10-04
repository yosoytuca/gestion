import type {LocalUnitOfWork, Repositories, RuntimeContext} from '../../../../datos/contracts/repositories/public';
import type {EntityType, SyncOperation} from '../../../../datos/contracts/entities';
import {storeNames, databaseVersion, type StoreName} from '../../../../datos/local/schema/public';
import {validateEntity, validateSyncOperation} from '../../../../datos/contracts/sync/validation';
import {validateInterpreter} from '../../../../datos/contracts/interpreter/validation';

type RecordValue = Record<string, unknown> & {id: string; userId: string};
interface Backup {format: 'gestor-backup'; version: 1; databaseVersion: number; userId: string; deviceId: string; exportedAt: string; stores: Record<StoreName, RecordValue[]>}
const check = (condition: unknown, message: string): void => {if (!condition) throw new Error(`Respaldo inválido: ${message}`);};
const string = (value: unknown) => typeof value === 'string' && value.length > 0;
const instant = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(string);
const entityStores = {activities: 'activity', groups: 'group', sessions: 'session', intervals: 'interval'} as const;

export async function exportBackup(uow: LocalUnitOfWork, runtime: RuntimeContext): Promise<string> {
  const stores = await uow.read(async r => Object.fromEntries(await Promise.all(storeNames.map(async name =>
    [name, (await r[name].list()).filter(record => record.userId === runtime.userId)]))) as Backup['stores']);
  return JSON.stringify({format: 'gestor-backup', version: 1, databaseVersion, userId: runtime.userId,
    deviceId: runtime.deviceId, exportedAt: runtime.now(), stores}, null, 2);
}

export function validateBackup(text: string, userId: string): Backup {
  check(text.length <= 20 * 1024 * 1024, 'archivo mayor de 20 MB.');
  const value = JSON.parse(text) as Backup;
  check(value && value.format === 'gestor-backup' && value.version === 1 && value.databaseVersion === databaseVersion, 'formato o versión incompatible.');
  check(value.userId === userId && string(value.deviceId) && instant(value.exportedAt), 'espacio o identificación incompatible.');
  check(value.stores && typeof value.stores === 'object' && Object.keys(value.stores).length === storeNames.length, 'colecciones incompletas.');
  for (const name of storeNames) {
    const records = value.stores[name]; check(Array.isArray(records), `falta ${name}.`);
    const ids = new Set<string>();
    for (const r of records) {
      check(r && typeof r === 'object' && string(r.id) && r.userId === userId && !ids.has(r.id), `identidad duplicada o ajena en ${name}.`); ids.add(r.id);
      if (name in entityStores) {
        validateEntity(entityStores[name as keyof typeof entityStores], r, userId);
        if (name === 'sessions') check(r.state === 'STOPPED' ? instant(r.stoppedAt) && Date.parse(r.stoppedAt as string) >= Date.parse(r.startedAt as string) : r.stoppedAt === null, 'fin de sesión inválido.');
      }
      else if (name === 'outbox') {
        validateSyncOperation(r as unknown as SyncOperation, userId, r.batchId as string);
        check(string(r.batchId) && string(r.deviceId) && instant(r.createdAt) && ['PENDING', 'ACKNOWLEDGED', 'CONFLICT'].includes(r.state as string), 'outbox inválida.');
      } else if (name === 'changes') {
        check(string(r.activityId) && string(r.mutationId) && string(r.action) && ['manual', 'interpreter', 'session'].includes(r.origin as string) && instant(r.occurredAt), 'auditoría inválida.');
        validateEntity('activity', r.nextValues, userId);
        if (r.previousValues !== null) validateEntity('activity', r.previousValues, userId);
      } else if (name === 'batches') {
        const response = validateInterpreter(r.response);
        check(r.id === response.inputId && Number.isInteger(r.revision) && (r.revision as number) > 0 && instant(r.updatedAt) && ['PREPARED', 'PARTIAL', 'APPLIED'].includes(r.state as string), 'lote inválido.');
        check(strings(r.appliedOpIds) && strings(r.preparedOpIds) && strings(r.blockedOpIds) && r.groupMap && typeof r.groupMap === 'object' && !Array.isArray(r.groupMap) && Object.values(r.groupMap).every(string), 'operaciones de lote inválidas.');
        const opIds = new Set(response.operations.map(op => op.opId));
        for (const key of ['appliedOpIds', 'preparedOpIds', 'blockedOpIds']) check((r[key] as string[]).every(id => opIds.has(id)), 'operación de lote inexistente.');
      } else if (name === 'metadata') check(r.id === userId && Number.isInteger(r.cursor) && (r.cursor as number) >= 0, 'cursor inválido.');
      else {
        check(instant(r.detectedAt) && (r.resolvedAt === null || instant(r.resolvedAt)), 'conflicto inválido.');
        if (name === 'conflicts') check(strings(r.intervalIds) && r.intervalIds.length === 2, 'intervalos de conflicto inválidos.');
        else {
          check(string(r.entityId), 'entidad de conflicto inválida.');
          validateEntity(r.entityType as EntityType, r.local, userId); validateEntity(r.entityType as EntityType, r.remote, userId);
        }
      }
    }
  }
  const has = (name: StoreName, id: unknown) => value.stores[name].some(r => r.id === id);
  for (const a of value.stores.activities) check(a.groupId === null || has('groups', a.groupId), 'grupo inexistente.');
  for (const s of value.stores.sessions) check(has('activities', s.activityId), 'actividad de sesión inexistente.');
  const runningDevices = new Set<unknown>();
  for (const s of value.stores.sessions.filter(s => s.state === 'RUNNING')) {
    check(!runningDevices.has(s.deviceId), 'más de una sesión activa en un dispositivo.'); runningDevices.add(s.deviceId);
  }
  for (const i of value.stores.intervals) {
    const session = value.stores.sessions.find(s => s.id === i.sessionId);
    check(session && session.activityId === i.activityId && session.deviceId === i.deviceId, 'relación de intervalo inválida.');
    if (i.endedAt === null) check(session?.state === 'RUNNING', 'intervalo abierto sin sesión activa.');
  }
  for (const s of value.stores.sessions) check(value.stores.intervals.filter(i => i.sessionId === s.id && i.endedAt === null).length === (s.state === 'RUNNING' ? 1 : 0), 'intervalos activos incoherentes.');
  for (const c of value.stores.changes) check(has('activities', c.activityId), 'actividad de auditoría inexistente.');
  for (const c of value.stores.conflicts) check((c.intervalIds as string[]).every(id => has('intervals', id)), 'intervalo de conflicto inexistente.');
  for (const b of value.stores.batches) check(Object.values(b.groupMap as Record<string, string>).every(id => has('groups', id)), 'grupo de lote inexistente.');
  return value;
}

export async function restoreBackup(uow: LocalUnitOfWork, runtime: RuntimeContext, text: string): Promise<{count: number; deviceId: string}> {
  const backup = validateBackup(text, runtime.userId);
  await uow.write(async r => {
    for (const name of storeNames) if ((await r[name].list()).length) throw new Error('Solo se puede restaurar en un espacio vacío. Tus datos actuales no se han modificado.');
    for (const name of storeNames) for (const record of backup.stores[name])
      await (r[name] as Repositories['activities'] as unknown as {put(record: RecordValue): Promise<void>}).put(record);
  });
  return {count: backup.stores.activities.filter(a => !a.deletedAt).length, deviceId: backup.deviceId};
}
