import type {CaptureContext} from '../interpreter/public';
export interface VoiceInput {audio: Blob; context: CaptureContext}
export interface TranscriptionResult {text: string; language: string; context: CaptureContext}
export interface VoiceProvider {transcribe(input: VoiceInput): Promise<TranscriptionResult>}
export interface VoiceRecorder {start(context:CaptureContext):Promise<void>;stop():Promise<VoiceInput>;cancel():void}
