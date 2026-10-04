import type {Category} from '../entities';
export interface CaptureContext {
  inputId: string; capturedAt: string; localDate: string; localTime: string; timeZone: string;
}
export interface Candidate {id: string; version: number}
export interface InterpreterInput extends CaptureContext {text: string; candidates: Candidate[]}
interface OperationBase {opId: string; evidence: string}
export type InterpreterOperation =
  | (OperationBase & {action: 'CREATE_GROUP'; tempId: string; title: string})
  | (OperationBase & {action: 'CREATE'; fields: {
    title: string; category: Category; type: 'TASK' | 'COMMITMENT'; dueDate: string | null;
    dueTime: string | null; reservedDurationMinutes: number | null; groupRef: string | null;
  }})
  | (OperationBase & {action: 'UPDATE'; targetId: string; expectedVersion: number;
    patch: import('../entities').ActivityPatch})
  | (OperationBase & {action: 'COMPLETE' | 'CANCEL' | 'DELETE'; targetId: string; expectedVersion: number});
export interface Clarification {
  id: string; reason: string; question: string; expression: string;
  affectedOpIds: string[]; candidateIds: string[]; options: string[];
  dateRange: {start: string; end: string} | null;
}
export interface InterpreterBatch {
  schemaVersion: '1.1'; inputId: string; operations: InterpreterOperation[]; clarifications: Clarification[];
}
export interface InterpreterProvider {interpret(input: InterpreterInput): Promise<unknown>}
