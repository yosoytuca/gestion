import type {BatchRecord} from '../../../../datos/contracts/entities';
import type {Candidate, InterpreterBatch, InterpreterOperation} from '../../../../datos/contracts/interpreter/public';
import {validateInterpreter} from '../../../../datos/contracts/interpreter/validation';
import type {Repositories} from '../../../../datos/contracts/repositories/public';
import {assert, validateActivity} from '../../../../datos/domain/activities/public';
import {createActivity, getActivity, updateActivity} from '../../modules/activities/public';
import {createGroup} from '../../modules/activity-groups/public';
import {LocalKernel, commandContext, finishWorkflow} from './local-kernel';

export class InterpreterWorkflow {
  constructor(private readonly kernel: LocalKernel) {}
  async prepare(value: unknown, candidates: Candidate[] = []): Promise<BatchRecord> {
    const response = validateInterpreter(value);
    return this.kernel.uow.write(async r => {
      const previous = await r.batches.get(response.inputId);
      assert(!previous || previous.userId === this.kernel.runtime.userId, 'UNAUTHORIZED_TARGET', 'Lote de otro usuario.');
      const oldResponse = previous ? validateInterpreter(previous.response) : null;
      for (const id of previous?.appliedOpIds ?? []) {
        assert(JSON.stringify(oldResponse!.operations.find(op => op.opId === id)) ===
          JSON.stringify(response.operations.find(op => op.opId === id)), 'APPLIED_OPERATION_CHANGED', 'No cambiar operaciones ya aplicadas.');
      }
      for (const op of response.operations) if ('targetId' in op && !previous?.appliedOpIds.includes(op.opId)) {
        assert(candidates.some(c => c.id === op.targetId && c.version === op.expectedVersion), 'UNAUTHORIZED_TARGET', 'Objetivo no autorizado en candidatos.');
        const a = await getActivity(r, this.kernel.runtime.userId, op.targetId, op.expectedVersion);
        if (op.action === 'UPDATE') validateActivity({...a, ...op.patch});
      }
      for (const op of response.operations) if (op.action === 'CREATE') {
        const {groupRef: _groupRef, ...fields} = op.fields;
        validateActivity({...fields, id: 'validation', userId: this.kernel.runtime.userId, groupId: null,
          timeZone: this.kernel.runtime.timeZone, status: 'PENDING', version: 1,
          createdAt: this.kernel.runtime.now(), updatedAt: this.kernel.runtime.now(), completedAt: null, cancelledAt: null, deletedAt: null});
      }
      const blocked = new Set(response.clarifications.flatMap(c => c.affectedOpIds));
      // Unbound clarification has no executable operation; keep it as an unresolved item.
      for (const op of response.operations) if (op.action === 'CREATE' && op.fields.groupRef) {
        const group = response.operations.find(g => g.action === 'CREATE_GROUP' && g.tempId === op.fields.groupRef)!;
        if (blocked.has(group.opId)) blocked.add(op.opId);
      }
      const applied = previous?.appliedOpIds ?? [];
      assert(applied.every(id => !blocked.has(id)), 'APPLIED_OPERATION_CHANGED', 'Una operación aplicada no puede volverse ambigua.');
      const prepared = response.operations.filter(op => !blocked.has(op.opId) && !applied.includes(op.opId)).map(op => op.opId);
      const pending = [...blocked, ...response.clarifications.filter(c => !c.affectedOpIds.length).map(c => `clarification:${c.id}`)];
      const record: BatchRecord = {id: response.inputId, userId: this.kernel.runtime.userId,
        revision: (previous?.revision ?? 0) + 1, response, appliedOpIds: applied, preparedOpIds: prepared,
        blockedOpIds: pending, groupMap: previous?.groupMap ?? {},
        state: pending.length || prepared.length ? (applied.length ? 'PARTIAL' : 'PREPARED') : 'APPLIED', updatedAt: this.kernel.runtime.now()};
      await r.batches.put(record); return record;
    });
  }
  async applyPrepared(id: string, revision: number): Promise<BatchRecord> {
    return this.kernel.uow.write(async r => {
      const record = await r.batches.get(id);
      assert(record && record.userId === this.kernel.runtime.userId, 'MISSING_BATCH', 'Lote no disponible.');
      assert(record.revision === revision, 'STALE_BATCH', 'El borrador cambió.');
      const response = validateInterpreter(record.response);
      const c = commandContext(r, this.kernel.runtime, 'interpreter', this.kernel.runtime.id());
      const prepared = response.operations.filter(op => record.preparedOpIds.includes(op.opId));
      for (const op of prepared.filter(op => op.action === 'CREATE_GROUP')) if (op.action === 'CREATE_GROUP') {
        record.groupMap[op.tempId] = (await createGroup(c, op.title)).id;
      }
      for (const op of prepared.filter(op => op.action !== 'CREATE_GROUP')) await this.execute(r, c, op, record);
      record.appliedOpIds.push(...record.preparedOpIds);
      record.preparedOpIds = [];
      record.state = record.blockedOpIds.length ? 'PARTIAL' : 'APPLIED';
      record.revision++; record.updatedAt = this.kernel.runtime.now();
      await r.batches.put(record); return record;
    });
  }
  private async execute(r: Repositories, c: ReturnType<typeof commandContext>, op: InterpreterOperation, record: BatchRecord) {
    if (op.action === 'CREATE') {
      const {groupRef, ...fields} = op.fields;
      const groupId = groupRef ? record.groupMap[groupRef] : null;
      assert(!groupRef || groupId, 'INVALID_GROUP', 'Grupo no aplicado.');
      await createActivity(r, c, {...fields, groupId});
    } else if (op.action === 'UPDATE') await updateActivity(r, c, op.targetId, op.patch, op.expectedVersion);
    else if (op.action !== 'CREATE_GROUP') await finishWorkflow(r, c, op.targetId, op.action, op.expectedVersion);
  }
  async get(id: string): Promise<InterpreterBatch | undefined> {
    return this.kernel.uow.read(async r => {
      const record = await r.batches.get(id);
      return record?.userId === this.kernel.runtime.userId ? validateInterpreter(record.response) : undefined;
    });
  }
}
