export const databaseVersion = 2;
export const storeNames = ['activities', 'groups', 'sessions', 'intervals', 'changes', 'outbox',
  'conflicts', 'syncConflicts', 'batches', 'metadata'] as const;
export type StoreName = typeof storeNames[number];
