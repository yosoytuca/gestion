import type {Entity, EntityType, SyncOperation} from '../entities';
import {assert, validateActivity} from '../../domain/activities/public';

export function validateEntity(type: EntityType, value: unknown, userId: string): asserts value is Entity {
  assert(typeof value === 'object' && value !== null, 'INVALID_SYNC', 'Entidad inválida.');
  const v = value as Record<string, unknown>;
  assert(v.userId === userId && typeof v.id === 'string' && v.id.length > 0, 'INVALID_SYNC', 'Identidad inválida.');
  assert(typeof v.version === 'number' && Number.isInteger(v.version) && v.version >= 1, 'INVALID_SYNC', 'Versión inválida.');
  for (const key of ['createdAt', 'updatedAt']) assert(typeof v[key] === 'string' && Number.isFinite(Date.parse(v[key] as string)), 'INVALID_SYNC', 'Timestamp inválido.');
  if (type === 'activity') {
    const nullable = ['groupId', 'dueDate', 'dueTime', 'completedAt', 'cancelledAt', 'deletedAt'];
    assert(nullable.every(k => v[k] === null || typeof v[k] === 'string') && typeof v.timeZone === 'string', 'INVALID_SYNC', 'Campos de actividad inválidos.');
    validateActivity(value as import('../entities').Activity);
  } else if (type === 'group') {
    assert(typeof v.title === 'string' && v.title.trim().length > 0 && v.title.length <= 300 &&
      (v.deletedAt === null || typeof v.deletedAt === 'string'), 'INVALID_SYNC', 'Grupo inválido.');
  } else if (type === 'session' || type === 'interval') {
    assert(typeof v.activityId === 'string' && typeof v.deviceId === 'string' && typeof v.startedAt === 'string' &&
      Number.isFinite(Date.parse(v.startedAt)), 'INVALID_SYNC', 'Sesión o intervalo inválido.');
    if (type === 'session') assert(['RUNNING', 'PAUSED', 'STOPPED'].includes(v.state as string) &&
      (v.stoppedAt === null || typeof v.stoppedAt === 'string'), 'INVALID_SYNC', 'Estado de sesión inválido.');
    else assert(typeof v.sessionId === 'string' && (v.endedAt === null ||
      (typeof v.endedAt === 'string' && Number.isFinite(Date.parse(v.endedAt)) && Date.parse(v.endedAt) >= Date.parse(v.startedAt))),
      'INVALID_SYNC', 'Intervalo inválido.');
  } else assert(false, 'INVALID_SYNC', 'Tipo de entidad desconocido.');
}
export function validateSyncOperation(op: SyncOperation, userId: string, batchId: string): void {
  assert(op && op.userId === userId && op.batchId === batchId && typeof op.mutationId === 'string' &&
    op.id === op.mutationId && typeof op.entityId === 'string' && typeof op.action === 'string' &&
    Number.isInteger(op.sequence) && (op.baseVersion === null || Number.isInteger(op.baseVersion)), 'INVALID_SYNC', 'Sobre de sincronización inválido.');
  validateEntity(op.entityType, op.payload, userId);
  assert(op.entityId === op.payload.id && op.payload.version === (op.baseVersion ?? 0) + 1,
    'INVALID_SYNC', 'Versión o identificador incoherente.');
}
