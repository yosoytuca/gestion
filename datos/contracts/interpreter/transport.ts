import type {Activity} from '../entities';
import type {InterpreterInput, InterpreterBatch} from './public';
export type CandidateDetails = Pick<Activity, 'id' | 'version' | 'title' | 'category' | 'type' | 'dueDate' | 'dueTime' | 'status' | 'reservedDurationMinutes' | 'groupId'>;
/** Transport enrichment; the existing interpreter port and domain contract are unchanged. */
export interface InterpreterRequest {
  input: InterpreterInput;
  candidateDetails: CandidateDetails[];
  recentIds: string[];
  clarification?: {previous: InterpreterBatch; appliedOpIds: string[]; questionId: string; answer: string};
}
