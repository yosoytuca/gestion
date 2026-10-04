import type {Entity, EntityType, SyncOperation} from '../entities';
export interface SyncEntry {cursor: number; entityType: EntityType; entity: Entity}
export interface PushResult {batchId: string; acceptedIds: string[]; conflict: boolean}
export interface PullResult {entries: SyncEntry[]; nextCursor: number}
export interface SyncTransport {
  push(userId: string, batchId: string, operations: SyncOperation[]): Promise<PushResult>;
  pull(userId: string, cursor: number): Promise<PullResult>;
}
