import type {ActivityInput, ActivityPatch, Entity, EntityType} from '../../../../datos/contracts/entities';
import type {CommandContext, LocalUnitOfWork, Repositories, RuntimeContext} from '../../../../datos/contracts/repositories/public';
import {sortPending} from '../../../../datos/domain/activities/public';
import {activeMilliseconds} from '../../../../datos/domain/sessions/public';
import {createActivity, finishActivity, getActivity, updateActivity} from '../../modules/activities/public';
import {createGroup, groupProgress} from '../../modules/activity-groups/public';
import {queryHistory, type HistoryFilter} from '../../modules/history/public';
import {getSession, pauseSession, resumeSession, startSession, stopSession} from '../../modules/timer/public';

export function commandContext(r: Repositories, runtime: RuntimeContext, origin: CommandContext['origin'], batchId: string): CommandContext {
  const instant = runtime.now();
  return {...runtime, now: () => instant, origin, batchId,
    async save(type: EntityType, entity: Entity, action: string, previous: Entity | null) {
      const repository = {activity: r.activities, group: r.groups, session: r.sessions, interval: r.intervals}[type];
      // EntityType and payload are paired by the typed callers; repository ports retain entity-specific types.
      await (repository.put as (entity: Entity) => Promise<void>)(entity);
      const mutationId = runtime.id();
      const sequence = Math.max(0, ...(await r.outbox.list()).map(op => op.sequence)) + 1;
      await r.outbox.put({id: mutationId, mutationId, batchId, userId: runtime.userId, deviceId: runtime.deviceId,
        sequence, entityType: type, entityId: entity.id, action, baseVersion: previous?.version ?? null,
        payload: entity, createdAt: instant, state: 'PENDING'});
      if (type === 'activity') await r.changes.put({id: runtime.id(), userId: runtime.userId, activityId: entity.id,
        mutationId, action, origin, previousValues: previous as import('../../../../datos/contracts/entities').Activity | null,
        nextValues: entity as import('../../../../datos/contracts/entities').Activity, occurredAt: instant});
    }};
}
export async function finishWorkflow(r: Repositories, c: CommandContext, id: string,
  action: 'COMPLETE' | 'CANCEL' | 'DELETE', version?: number) {
  await getActivity(r, c.userId, id, version);
  for (const s of await r.sessions.list()) if (s.activityId === id && s.userId === c.userId && s.deviceId === c.deviceId && s.state !== 'STOPPED')
    await stopSession(r, c, s.id);
  return finishActivity(r, c, id, action, version);
}
export class LocalKernel {
  constructor(readonly uow: LocalUnitOfWork, readonly runtime: RuntimeContext) {}
  command<T>(origin: CommandContext['origin'], work: (r: Repositories, c: CommandContext) => Promise<T>, batchId = this.runtime.id()): Promise<T> {
    return this.uow.write(r => work(r, commandContext(r, this.runtime, origin, batchId)));
  }
  create(input: ActivityInput) {return this.command('manual', (r, c) => createActivity(r, c, input));}
  update(id: string, patch: ActivityPatch, version?: number) {return this.command('manual', (r, c) => updateActivity(r, c, id, patch, version));}
  finish(id: string, action: 'COMPLETE' | 'CANCEL' | 'DELETE', version?: number) {return this.command('manual', (r, c) => finishWorkflow(r, c, id, action, version));}
  createGroup(title: string) {return this.command('manual', (_r, c) => createGroup(c, title));}
  groupProgress(id: string) {return this.uow.read(r => groupProgress(r, this.runtime.userId, id));}
  start(id: string) {return this.command('session', async (r, c) => startSession(r, c, await getActivity(r, c.userId, id)));}
  pause(id: string) {return this.command('session', (r, c) => pauseSession(r, c, id));}
  resume(id: string) {return this.command('session', async (r, c) => {
    const s = await getSession(r, c, id); return resumeSession(r, c, id, await getActivity(r, c.userId, s.activityId));
  });}
  stop(id: string) {return this.command('session', (r, c) => stopSession(r, c, id));}
  pending() {return this.uow.read(async r => sortPending((await r.activities.list()).filter(a => a.userId === this.runtime.userId), this.runtime.now(), this.runtime.timeZone));}
  history(filter?: HistoryFilter) {return this.uow.read(r => queryHistory(r, this.runtime.userId, this.runtime.timeZone, filter));}
  time(id: string, includeOpen = false) {return this.uow.read(async r => {
    const intervals = (await r.intervals.list()).filter(i => i.userId === this.runtime.userId && i.activityId === id);
    const conflicts = (await r.conflicts.list()).filter(c => c.userId === this.runtime.userId && !c.resolvedAt && c.intervalIds.some(id => intervals.some(i => i.id === id)));
    return {milliseconds: conflicts.length ? null : activeMilliseconds(intervals, includeOpen ? this.runtime.now() : undefined), conflicts};
  });}
}
