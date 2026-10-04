import type {InterpreterProvider, InterpreterInput, InterpreterBatch} from '../../../../datos/contracts/interpreter/public';
import type {InterpreterRequest} from '../../../../datos/contracts/interpreter/transport';
import {validateInterpreter} from '../../../../datos/contracts/interpreter/validation';
import {localClock, validateActivity, validDate} from '../../../../datos/domain/activities/public';
import type {Activity} from '../../../../datos/contracts/entities';
import {structuredSchema, normalizeOutput} from './structured-output';
import {interpreterInstructions} from './prompt';
export class InterpreterError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {super(message);}
}
export interface AIProvider {generate(request: InterpreterRequest): Promise<unknown>}
const invalid = () => new InterpreterError(422, 'INVALID_INPUT', 'El texto o su contexto no son válidos.');
export function validateRequest(value: unknown): InterpreterRequest {
  const r = value as InterpreterRequest, i = r?.input;
  if (!i || typeof i.text !== 'string' || !i.text.trim() || i.text.length > 20000 || !/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(i.inputId) ||
    !validDate(i.localDate) || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(i.localTime) || !Number.isFinite(Date.parse(i.capturedAt))) throw invalid();
  try {const clock = localClock(i.capturedAt, i.timeZone); if (clock.date !== i.localDate || clock.time !== i.localTime.slice(0,5)) throw invalid();} catch {throw invalid();}
  if (!Array.isArray(i.candidates) || i.candidates.length > 8 || !Array.isArray(r.candidateDetails) || r.candidateDetails.length !== i.candidates.length ||
    new Set(i.candidates.map(c => c.id)).size !== i.candidates.length || new Set(r.candidateDetails.map(c=>c?.id)).size !== r.candidateDetails.length || !Array.isArray(r.recentIds) || r.recentIds.length > 8) throw invalid();
  for (const c of r.candidateDetails) {
    if (!c || !/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(c.id) || !i.candidates.some(x => x.id === c.id && x.version === c.version) || typeof c.title !== 'string' || !(c.groupId===null || typeof c.groupId==='string')) throw invalid();
    try {validateActivity(asActivity(c, i));} catch {throw invalid();}
  }
  if (r.recentIds.some(id => !i.candidates.some(c => c.id === id))) throw invalid();
  if (r.clarification) {
    const c = r.clarification; const previous = validateInterpreter(c.previous);
    if (previous.inputId !== i.inputId || !previous.clarifications.some(x => x.id === c.questionId) || typeof c.answer !== 'string' || !c.answer.trim() || c.answer.length > 1000 || !Array.isArray(c.appliedOpIds) || c.appliedOpIds.some(id => !previous.operations.some(op => op.opId === id))) throw invalid();
  }
  // Explicit allowlist: never forward arbitrary request properties or browser data.
  return {input: {inputId:i.inputId,text:i.text,capturedAt:i.capturedAt,localDate:i.localDate,localTime:i.localTime,timeZone:i.timeZone,candidates:i.candidates.map(c => ({id:c.id,version:c.version}))},
    candidateDetails:r.candidateDetails.map(c => ({id:c.id,version:c.version,title:c.title,category:c.category,type:c.type,dueDate:c.dueDate,dueTime:c.dueTime,status:c.status,reservedDurationMinutes:c.reservedDurationMinutes,groupId:c.groupId})),recentIds:[...r.recentIds],
    ...(r.clarification ? {clarification:r.clarification} : {})};
}
function asActivity(c: Partial<Activity>, i: InterpreterInput): Activity {
  return {id:i.inputId,userId:'validation',createdAt:i.capturedAt,updatedAt:i.capturedAt,version:1,title:'',category:'PERSONAL',type:'TASK',groupId:null,dueDate:null,dueTime:null,reservedDurationMinutes:null,status:'PENDING',completedAt:c.status === 'COMPLETED' ? i.capturedAt : null,cancelledAt:c.status === 'CANCELLED' ? i.capturedAt : null,deletedAt:null,...c,timeZone:i.timeZone};
}
export function validateProposal(value: unknown, r: InterpreterRequest): InterpreterBatch {
  const batch = validateInterpreter(value);
  if (batch.inputId !== r.input.inputId) throw new Error('Wrong inputId');
  for (const op of batch.operations) {
    if (r.clarification?.appliedOpIds.includes(op.opId)) {
      if (JSON.stringify(op) !== JSON.stringify(r.clarification.previous.operations.find(x => x.opId === op.opId))) throw new Error('Applied operation changed');
      continue;
    }
    if ('targetId' in op) {
      const target = r.candidateDetails.find(c => c.id === op.targetId && c.version === op.expectedVersion);
      if (!target) throw new Error('Unknown or stale candidate');
      if (op.action === 'UPDATE') {
        if(op.patch.groupId && op.patch.groupId!==target.groupId) throw new Error('Unknown group');
        validateActivity(asActivity({...target,...op.patch},r.input));
      }
    } else if (op.action === 'CREATE') validateActivity(asActivity({...op.fields,groupId:null},r.input));
  }
  if (r.clarification?.appliedOpIds.some(id => !batch.operations.some(op => op.opId === id))) throw new Error('Applied operation missing');
  for (const c of batch.clarifications) if (c.candidateIds.some(id => !r.input.candidates.some(x => x.id === id))) throw new Error('Unknown clarification candidate');
  return batch;
}
export class RealInterpreterProvider implements InterpreterProvider {
  constructor(private readonly ai: AIProvider, private readonly enrich: (input: InterpreterInput) => InterpreterRequest = input => ({input,candidateDetails:[],recentIds:[]})) {}
  async interpret(input: InterpreterInput) {return this.interpretRequest(this.enrich(input));}
  async interpretRequest(value: unknown) {
    const request = validateRequest(value);
    const proposal = await this.ai.generate(request);
    try {return validateProposal(proposal,request);} catch {throw new InterpreterError(502,'INVALID_OUTPUT','La IA devolvió una propuesta inválida. Reintenta; no se guardó ninguna actividad.');}
  }
}
export class OpenAIProvider implements AIProvider {
  constructor(private readonly key: string, private readonly model = 'gpt-5.4-mini', private readonly transport: typeof fetch = fetch, private readonly timeoutMs = 30000) {}
  async generate(request: InterpreterRequest) {
    if (!this.key) throw new InterpreterError(503,'NOT_CONFIGURED','Falta configurar AI_API_KEY en el servidor. Puedes crear actividades manualmente.');
    let response: Response;
    try {response = await this.transport('https://api.openai.com/v1/responses', {method:'POST',signal:AbortSignal.timeout(this.timeoutMs),headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.key}`},
      body:JSON.stringify({model:this.model,store:false,instructions:interpreterInstructions,input:JSON.stringify(request),max_output_tokens:6000,reasoning:{effort:'low'},text:{format:{type:'json_schema',name:'interpreter_batch',strict:true,schema:structuredSchema()}}})});}
    catch (e) {throw new InterpreterError(504,'TIMEOUT',(e as Error).name === 'TimeoutError' ? 'La IA tardó demasiado. Reintenta.' : 'No se pudo conectar con la IA. Reintenta.');}
    if (!response.ok) throw new InterpreterError(response.status === 429 ? 429 : 502,response.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR',response.status === 429 ? 'La IA está ocupada. Espera un momento y reintenta.' : 'El proveedor de IA no está disponible. Revisa la configuración del servidor.');
    try {
      const envelope = await response.json() as any;
      if (envelope.status !== 'completed') throw new Error('Incomplete');
      const text = envelope.output.flatMap((o: any) => o.type === 'message' ? o.content : []).filter((c: any) => c.type === 'output_text').map((c: any) => c.text).join('');
      return normalizeOutput(JSON.parse(text));
    } catch {throw new InterpreterError(502,'INVALID_OUTPUT','La IA no produjo una propuesta completa válida. Reintenta.');}
  }
}
