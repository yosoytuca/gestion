import canonical from '../../../../datos/contracts/interpreter/interpreter-response.schema.json';
/** Only the provider wire format changes: optional PATCH keys become typed changes. */
export function structuredSchema(): Record<string, unknown> {
  const schema = structuredClone(canonical) as any;
  schema.$defs.patch = {type: 'array', items: {anyOf: Object.entries(schema.$defs.patch.properties).map(([field, value]) => ({
    type: 'object', additionalProperties: false, required: ['field', 'value'], properties: {field: {type: 'string', enum: [field]}, value}
  }))}};
  function visit(node: any): void {
    if (!node || typeof node !== 'object') return;
    if (node.const !== undefined) {node.enum = [node.const]; delete node.const;}
    if (node.enum && !node.type) node.type = 'string';
    if (node.oneOf) {node.anyOf = node.oneOf; delete node.oneOf;}
    for (const key of ['$schema', 'title', 'minProperties', 'uniqueItems']) delete node[key];
    if (node.properties) {node.required = Object.keys(node.properties); node.additionalProperties = false;}
    for (const key of ['properties','$defs']) if(node[key]) Object.values(node[key]).forEach(visit);
    for(const key of ['items','anyOf']) if(node[key]) {if(Array.isArray(node[key])) node[key].forEach(visit);else visit(node[key]);}
  }
  visit(schema); return schema;
}
export function normalizeOutput(value: unknown): unknown {
  const batch = structuredClone(value) as any;
  if (!batch || !Array.isArray(batch.operations)) return batch;
  for (const operation of batch.operations) if (operation.action === 'UPDATE' && Array.isArray(operation.patch)) {
    const patch: Record<string, unknown> = Object.create(null);
    for (const change of operation.patch) {
      if (!change || typeof change.field !== 'string' || !Object.hasOwn(change, 'value') || Object.hasOwn(patch, change.field)) throw new Error('Invalid patch');
      patch[change.field] = change.value;
    }
    operation.patch = patch;
  }
  return batch;
}
