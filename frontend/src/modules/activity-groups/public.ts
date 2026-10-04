import type {ActivityGroup} from '../../../../datos/contracts/entities';
import type {CommandContext, Repositories} from '../../../../datos/contracts/repositories/public';
import {assert} from '../../../../datos/domain/activities/public';

export async function createGroup(c: CommandContext, title: string): Promise<ActivityGroup> {
  assert(typeof title === 'string' && title.trim().length > 0 && title.length <= 300, 'INVALID_TITLE', 'Nombre de grupo inválido.');
  const now = c.now();
  const group: ActivityGroup = {id: c.id(), userId: c.userId, title: title.trim(), createdAt: now,
    updatedAt: now, version: 1, deletedAt: null};
  await c.save('group', group, 'CREATE', null); return group;
}
export async function groupProgress(r: Repositories, userId: string, id: string) {
  const children = (await r.activities.list()).filter(a => a.userId === userId && a.groupId === id && !a.deletedAt);
  return {total: children.length, completed: children.filter(a => a.status === 'COMPLETED').length,
    pending: children.filter(a => a.status === 'PENDING').length, cancelled: children.filter(a => a.status === 'CANCELLED').length};
}
