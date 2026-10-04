import type {Activity, ActivityChange, ActivityGroup, BatchRecord, SessionConflict,
  SyncMetadata, SyncOperation, WorkInterval, WorkSession, Entity, EntityType, SyncConflict} from '../entities';

export interface Repository<T extends {id: string}> {
  get(id: string): Promise<T | undefined>;
  list(): Promise<T[]>;
  put(value: T): Promise<void>;
}
export type ActivityRepository = Repository<Activity>;
export type ActivityGroupRepository = Repository<ActivityGroup>;
export type SessionRepository = Repository<WorkSession>;
export type IntervalRepository = Repository<WorkInterval>;
export type ChangeRepository = Repository<ActivityChange>;
export type SyncOutboxRepository = Repository<SyncOperation>;
export interface Repositories {
  activities: ActivityRepository; groups: ActivityGroupRepository;
  sessions: SessionRepository; intervals: IntervalRepository;
  changes: ChangeRepository; outbox: SyncOutboxRepository;
  conflicts: Repository<SessionConflict>; batches: Repository<BatchRecord>;
  syncConflicts: Repository<SyncConflict>;
  metadata: Repository<SyncMetadata>;
}
export interface LocalUnitOfWork {
  read<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
  write<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
  close(): void;
}
export interface RuntimeContext {
  userId: string; deviceId: string; timeZone: string;
  now(): string; id(): string;
}
export interface CommandContext extends RuntimeContext {
  batchId: string;
  origin: 'manual' | 'interpreter' | 'session';
  save(type: EntityType, entity: Entity, action: string, previous: Entity | null): Promise<void>;
}
