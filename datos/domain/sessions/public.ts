import type {SessionConflict, WorkInterval} from '../../contracts/entities';
import {assert} from '../activities/public';

export function activeMilliseconds(intervals: WorkInterval[], now?: string): number {
  return intervals.reduce((total, interval) => {
    const end = interval.endedAt ?? now;
    if (!end) return total;
    const elapsed = Date.parse(end) - Date.parse(interval.startedAt);
    assert(Number.isFinite(elapsed) && elapsed >= 0, 'CLOCK_ERROR', 'Reloj incoherente; no se contabiliza tiempo negativo.');
    return total + elapsed;
  }, 0);
}
export function detectOverlaps(intervals: WorkInterval[], detectedAt: string): SessionConflict[] {
  const conflicts: SessionConflict[] = [];
  for (let i = 0; i < intervals.length; i++) for (let j = i + 1; j < intervals.length; j++) {
    const a = intervals[i]!, b = intervals[j]!;
    if (a.userId !== b.userId || a.deviceId === b.deviceId) continue;
    const start = Math.max(Date.parse(a.startedAt), Date.parse(b.startedAt));
    const end = Math.min(a.endedAt ? Date.parse(a.endedAt) : Infinity, b.endedAt ? Date.parse(b.endedAt) : Infinity);
    if (start < end) {
      const ids = [a.id, b.id].sort() as [string, string];
      conflicts.push({id: `overlap:${ids.join(':')}`, userId: a.userId, intervalIds: ids, detectedAt, resolvedAt: null});
    }
  }
  return conflicts;
}
