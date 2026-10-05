import type {Activity, ActivityGroup, ActivityInput, BatchRecord, Category, HistoryFilter, WorkInterval, WorkSession} from '../../../datos/contracts/entities';
import type {CaptureContext, InterpreterInput} from '../../../datos/contracts/interpreter/public';
import type {TranscriptionResult} from '../../../datos/contracts/voice/public';

export interface UiSnapshot {
  pending: Activity[]; all: Activity[]; groups: ActivityGroup[]; sessions: WorkSession[];
  groupProgress: Record<string, {total: number; completed: number; pending: number; cancelled: number}>;
  intervals: WorkInterval[]; conflictedActivityIds: string[]; outboxCount: number;
  batches: BatchRecord[]; now: string; timeZone: string; deviceId: string;
}
export interface UiPort {
  interpreterMode?: 'real' | 'mock';
  resolveClarification?(batch:BatchRecord,id:string,answer:string):Promise<BatchRecord>;
  snapshot(): Promise<UiSnapshot>;
  save(input: ActivityInput, activity?: Activity): Promise<Activity>;
  finish(activity: Activity, action: 'COMPLETE' | 'CANCEL' | 'DELETE'): Promise<void>;
  timer(activity: Activity, action: 'START' | 'PAUSE' | 'RESUME' | 'STOP' | 'STOP_COMPLETE'): Promise<string>;
  history(filter: HistoryFilter): Promise<Activity[]>;
  capture(input: InterpreterInput, voice: boolean, scenario: 'clear' | 'mixed'): Promise<BatchRecord>;
  transcribe(context: CaptureContext): Promise<TranscriptionResult>;
  beginVoice?(context:CaptureContext):Promise<void>;
  finishVoice?():Promise<TranscriptionResult>;
  cancelVoice?():void;
  captureDraft?(voice:boolean):{text:string;context?:CaptureContext};
  saveCaptureDraft?(voice:boolean,draft:{text:string;context?:CaptureContext}):void;
  manualCapture?(text:string,context:CaptureContext):Promise<BatchRecord>;
  editProposal?(batch:BatchRecord,opId:string,fields:Extract<import('../../../datos/contracts/interpreter/public').InterpreterOperation,{action:'CREATE'}>['fields']):Promise<BatchRecord>;
  apply(batch: BatchRecord): Promise<BatchRecord>;
  resolveTime(batch: BatchRecord, clarificationId: string, time: string): Promise<BatchRecord>;
  useDemo(reset?: boolean): Promise<void>;
  usePersonal(): Promise<void>;
  exportBackup(): Promise<string>;
  restoreBackup(text: string): Promise<string>;
  mode: 'personal' | 'demo';
}
export const categoryLabels: Record<Category, string> = {WORK: 'Trabajo', EDUCATION: 'Educación', HEALTH: 'Salud', PERSONAL: 'Personal'};
