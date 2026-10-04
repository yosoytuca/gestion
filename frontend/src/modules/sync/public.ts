import type {Entity, SyncOperation} from '../../../../datos/contracts/entities';
import type {LocalUnitOfWork, Repositories, RuntimeContext, Repository} from '../../../../datos/contracts/repositories/public';
import type {SyncTransport} from '../../../../datos/contracts/sync/public';
import {validateEntity} from '../../../../datos/contracts/sync/validation';
import {assert} from '../../../../datos/domain/activities/public';
import {detectOverlaps} from '../../../../datos/domain/sessions/public';

export class SyncEngine {
  constructor(private readonly uow: LocalUnitOfWork, private readonly runtime: RuntimeContext, private readonly transport: SyncTransport) {}
  async push(): Promise<void> {
    const operations = await this.uow.read(async r => (await r.outbox.list())
      .filter(op => op.userId === this.runtime.userId && op.state === 'PENDING').sort((a, b) => a.sequence - b.sequence));
    const batches = new Map<string, SyncOperation[]>();
    for (const op of operations) batches.set(op.batchId, [...(batches.get(op.batchId) ?? []), op]);
    for (const [batchId, batch] of batches) {
      const result = await this.transport.push(this.runtime.userId, batchId, batch);
      assert(result.batchId === batchId && typeof result.conflict === 'boolean' && Array.isArray(result.acceptedIds) &&
        (result.conflict ? result.acceptedIds.length === 0 : result.acceptedIds.length === batch.length &&
          new Set(result.acceptedIds).size === batch.length && result.acceptedIds.every(id => batch.some(op => op.id === id))),
        'INVALID_SYNC', 'Respuesta de push inválida.');
      await this.uow.write(async r => {
        for (const op of batch) await r.outbox.put({...op, state: result.conflict ? 'CONFLICT' : 'ACKNOWLEDGED'});
      });
      if (result.conflict) break; // Later local versions depend on this rejected base.
    }
  }
  async pull(): Promise<void> {
    const userId = this.runtime.userId;
    const cursor = await this.uow.read(async r => (await r.metadata.get(userId))?.cursor ?? 0);
    const result = await this.transport.pull(userId, cursor);
    assert(Array.isArray(result.entries) && Number.isInteger(result.nextCursor) && result.nextCursor >= cursor,
      'INVALID_SYNC', 'Página de pull inválida.');
    let last = cursor;
    for (const entry of result.entries) {
      assert(Number.isInteger(entry.cursor) && entry.cursor > last && entry.cursor <= result.nextCursor,
        'INVALID_SYNC', 'Cursor de entrada inválido.');
      validateEntity(entry.entityType, entry.entity, userId); last = entry.cursor;
    }
    await this.uow.write(async r => {
      assert(((await r.metadata.get(userId))?.cursor ?? 0) === cursor, 'STALE_CURSOR', 'Otro proceso avanzó el cursor.');
      const outbox = (await r.outbox.list()).filter(op => op.userId === userId && op.state !== 'ACKNOWLEDGED');
      for (const entry of result.entries) {
        const dirty = outbox.filter(op => op.entityType === entry.entityType && op.entityId === entry.entity.id);
        if (dirty.length) {
          const latest = [...dirty].sort((a, b) => b.sequence - a.sequence)[0]!;
          const earliestBase = Math.min(...dirty.map(op => op.baseVersion ?? 0));
          if (entry.entity.version <= earliestBase) continue;
          if (JSON.stringify(latest.payload) !== JSON.stringify(entry.entity)) {
            for (const op of dirty) await r.outbox.put({...op, state: 'CONFLICT'});
            await r.syncConflicts.put({id: `${entry.entityType}:${entry.entity.id}:${entry.entity.version}`,
              userId, entityType: entry.entityType, entityId: entry.entity.id, local: latest.payload,
              remote: entry.entity, detectedAt: this.runtime.now(), resolvedAt: null});
          }
          continue;
        }
        const repository = repositoryFor(r, entry.entityType);
        const current = await repository.get(entry.entity.id);
        if (!current || current.version < entry.entity.version) await repository.put(entry.entity);
      }
      const conflicts = detectOverlaps((await r.intervals.list()).filter(i => i.userId === userId), this.runtime.now());
      for (const conflict of conflicts) if (!await r.conflicts.get(conflict.id)) await r.conflicts.put(conflict);
      await r.metadata.put({id: userId, userId, cursor: result.nextCursor});
    });
  }
  async synchronize() {await this.push(); await this.pull();}
}
function repositoryFor(r: Repositories, type: string): Repository<Entity> {
  return {activity: r.activities, group: r.groups, session: r.sessions, interval: r.intervals}[type as 'activity'] as Repository<Entity>;
}
