import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from './interpreter-response.schema.json';
import type {InterpreterBatch} from './public';
import {assert, validDate} from '../../domain/activities/public';

const ajv = new Ajv2020({allErrors: true, strict: true, allowUnionTypes: true});
addFormats(ajv);
const validate = ajv.compile<InterpreterBatch>(schema);
export function validateInterpreter(value: unknown): InterpreterBatch {
  assert(validate(value), 'INVALID_JSON', `Respuesta inválida: ${ajv.errorsText(validate.errors)}`);
  const ids = value.operations.map(op => op.opId);
  assert(new Set(ids).size === ids.length, 'DUPLICATE_OPERATION', 'opId debe ser único.');
  const groupIds = value.operations.filter(op => op.action === 'CREATE_GROUP').map(op => op.tempId);
  assert(new Set(groupIds).size === groupIds.length, 'DUPLICATE_GROUP', 'tempId debe ser único.');
  const targets = new Set<string>();
  for (const op of value.operations) {
    if (op.action === 'CREATE') {
      assert(!op.fields.groupRef || groupIds.includes(op.fields.groupRef), 'INVALID_GROUP', 'groupRef no existe en el lote.');
      assert(!op.fields.dueTime || op.fields.dueDate, 'TIME_WITHOUT_DATE', 'Hora requiere fecha.');
    }
    const fields = op.action === 'CREATE' ? op.fields : op.action === 'UPDATE' ? op.patch : null;
    if (fields?.dueDate) assert(validDate(fields.dueDate), 'INVALID_DATE', 'Fecha imposible.');
    if ('targetId' in op) {
      assert(!targets.has(op.targetId), 'CONFLICTING_INTENT', 'Operaciones múltiples sobre el mismo objetivo.');
      targets.add(op.targetId);
    }
  }
  const clarificationIds = value.clarifications.map(c => c.id);
  assert(new Set(clarificationIds).size === clarificationIds.length, 'INVALID_CLARIFICATION', 'Aclaración repetida.');
  for (const c of value.clarifications) {
    assert(c.affectedOpIds.every(id => ids.includes(id)), 'INVALID_CLARIFICATION', 'Aclaración referencia operación inexistente.');
    if (c.dateRange) assert(validDate(c.dateRange.start) && validDate(c.dateRange.end) && c.dateRange.start <= c.dateRange.end,
      'INVALID_DATE', 'Rango inválido.');
  }
  return structuredClone(value);
}
