export const Categories = ['WORK', 'EDUCATION', 'HEALTH', 'PERSONAL'] as const;
export type Category = typeof Categories[number];
export interface HistoryFilter {category?: Category; from?: string; to?: string; query?: string; status?: 'COMPLETED' | 'CANCELLED'}
export type ActivityType = 'TASK' | 'COMMITMENT';
export type ActivityStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PersistedActivityStatus = Exclude<ActivityStatus, 'IN_PROGRESS'>;
export interface Versioned {
  id: string; userId: string; createdAt: string; updatedAt: string; version: number;
}
export interface Activity extends Versioned {
  title: string; category: Category; type: ActivityType; groupId: string | null;
  dueDate: string | null; dueTime: string | null; timeZone: string;
  reservedDurationMinutes: number | null; status: PersistedActivityStatus;
  completedAt: string | null; cancelledAt: string | null; deletedAt: string | null;
}
export type ActivityInput = Pick<Activity, 'title' | 'category' | 'type'> &
  Partial<Pick<Activity, 'groupId' | 'dueDate' | 'dueTime' | 'reservedDurationMinutes'>>;
export type ActivityPatch = Partial<ActivityInput>;
export interface ActivityGroup extends Versioned {title: string; deletedAt: string | null}
export interface WorkSession extends Versioned {
  activityId: string; deviceId: string; state: 'RUNNING' | 'PAUSED' | 'STOPPED';
  startedAt: string; stoppedAt: string | null;
}
export interface WorkInterval extends Versioned {
  sessionId: string; activityId: string; deviceId: string;
  startedAt: string; endedAt: string | null;
}
export interface ActivityChange {
  id: string; userId: string; activityId: string; mutationId: string;
  action: string; origin: 'manual' | 'interpreter' | 'session';
  previousValues: Activity | null; nextValues: Activity;
  occurredAt: string;
}
export type EntityType = 'activity' | 'group' | 'session' | 'interval';
export type Entity = Activity | ActivityGroup | WorkSession | WorkInterval;
export interface SyncOperation {
  id: string; mutationId: string; batchId: string; userId: string; deviceId: string;
  sequence: number; entityType: EntityType; entityId: string; action: string;
  baseVersion: number | null; payload: Entity; createdAt: string;
  state: 'PENDING' | 'ACKNOWLEDGED' | 'CONFLICT';
}
export interface SessionConflict {
  id: string; userId: string; intervalIds: [string, string]; detectedAt: string;
  resolvedAt: string | null;
}
export interface SyncConflict {
  id: string; userId: string; entityType: EntityType; entityId: string;
  local: Entity; remote: Entity; detectedAt: string; resolvedAt: string | null;
}
export interface BatchRecord {
  id: string; userId: string; revision: number; response: unknown;
  appliedOpIds: string[]; preparedOpIds: string[]; blockedOpIds: string[];
  groupMap: Record<string, string>;
  state: 'PREPARED' | 'PARTIAL' | 'APPLIED'; updatedAt: string;
}
export interface SyncMetadata {id: string; userId: string; cursor: number}
