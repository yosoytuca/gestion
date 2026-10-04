import type {Entity, SyncOperation} from '../../../../datos/contracts/entities';
import type {PullResult, PushResult, SyncEntry, SyncTransport} from '../../../../datos/contracts/sync/public';
import {validateSyncOperation} from '../../../../datos/contracts/sync/validation';
import {assert} from '../../../../datos/domain/activities/public';

/** In-memory test transport. Not an authenticated server or production repository. */
export class MockSyncTransport implements SyncTransport {
  private entities = new Map<string, Entity>();
  private feed: (SyncEntry & {userId: string})[] = [];
  private accepted = new Map<string, {signature: string; result: PushResult}>();
  private key(userId: string, type: string, id: string) {return `${userId}:${type}:${id}`;}
  async push(userId: string, batchId: string, operations: SyncOperation[]): Promise<PushResult> {
    assert(operations.length > 0, 'INVALID_SYNC', 'Lote vacío.');
    operations.forEach(op => validateSyncOperation(op, userId, batchId));
    const signature = JSON.stringify(operations.map(op => ({...op, state: 'PENDING'})));
    const batchKey = `${userId}:${batchId}`;
    const existing = this.accepted.get(batchKey);
    if (existing) {
      assert(existing.signature === signature, 'IDEMPOTENCY_MISMATCH', 'El lote cambió tras su envío.');
      return structuredClone(existing.result);
    }
    assert(new Set(operations.map(op => op.mutationId)).size === operations.length, 'INVALID_SYNC', 'Mutaciones repetidas.');
    const staged = new Map(this.entities);
    for (const op of operations) {
      const key = this.key(userId, op.entityType, op.entityId);
      const current = staged.get(key);
      if ((current?.version ?? null) !== op.baseVersion ||
        (current && 'deletedAt' in current && current.deletedAt)) return {batchId, acceptedIds: [], conflict: true};
      staged.set(key, structuredClone(op.payload));
    }
    this.entities = staged;
    for (const op of operations) this.feed.push({cursor: this.feed.length + 1, userId, entityType: op.entityType, entity: structuredClone(op.payload)});
    const result: PushResult = {batchId, acceptedIds: operations.map(op => op.id), conflict: false};
    this.accepted.set(batchKey, {signature, result});
    return result;
  }
  async pull(userId: string, cursor: number): Promise<PullResult> {
    const feed = this.feed.filter(entry => entry.userId === userId && entry.cursor > cursor);
    return {entries: structuredClone(feed.map(({userId: _userId, ...entry}) => entry)),
      nextCursor: feed.at(-1)?.cursor ?? cursor};
  }
}
