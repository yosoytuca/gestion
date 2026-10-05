import type {Activity, ActivityInput, BatchRecord, HistoryFilter} from '../../../../datos/contracts/entities';
import type {CaptureContext, InterpreterInput} from '../../../../datos/contracts/interpreter/public';
import type {VoiceProvider,VoiceRecorder} from '../../../../datos/contracts/voice/public';
import {validateInterpreter} from '../../../../datos/contracts/interpreter/validation';
import type {UiPort, UiSnapshot} from '../../shared/ui-contract';
import {CaptureService} from '../../modules/capture/public';
import {groupProgress} from '../../modules/activity-groups/public';
import {LocalKernel} from './local-kernel';
import {InterpreterWorkflow} from './interpreter-workflow';
import {exportBackup, restoreBackup} from './backup';
import {retrieveCandidates, type CaptureContextStore} from './interpreter-context';
import type {InterpreterRequest} from '../../../../datos/contracts/interpreter/transport';

export interface UiEnvironment {
  capture(scenario: 'clear' | 'mixed', request?: InterpreterRequest): CaptureService;
  interpreterMode?: 'real' | 'mock';
  contextStore?: CaptureContextStore;
  debug?: boolean;
  voice: VoiceProvider;
  recorder?:VoiceRecorder;
  switchMode(mode: 'personal' | 'demo', reset: boolean): Promise<void>;
  mode: 'personal' | 'demo';
  restoredDevice?(deviceId: string): void;
}
export class UiController implements UiPort {
  get mode() {return this.environment.mode;}
  get interpreterMode() {return this.environment.interpreterMode ?? 'mock';}
  private captures = new Map<string,InterpreterRequest>();
  private recentIds: string[] = [];
  constructor(private readonly kernel: LocalKernel, private readonly environment: UiEnvironment) {}
  async snapshot(): Promise<UiSnapshot> {
    const user = this.kernel.runtime.userId;
    const records = await this.kernel.uow.read(async r => {
      const groups = (await r.groups.list()).filter(g => g.userId === user && !g.deletedAt);
      const progress = Object.fromEntries(await Promise.all(groups.map(async g => [g.id, await groupProgress(r, user, g.id)])));
      return {
      all: (await r.activities.list()).filter(a => a.userId === user && !a.deletedAt),
      groups, groupProgress: progress,
      sessions: (await r.sessions.list()).filter(s => s.userId === user),
      intervals: (await r.intervals.list()).filter(i => i.userId === user),
      conflicts: (await r.conflicts.list()).filter(c => c.userId === user && !c.resolvedAt),
      outboxCount: (await r.outbox.list()).filter(op => op.userId === user && op.state !== 'ACKNOWLEDGED').length,
      batches: (await r.batches.list()).filter(b => b.userId === user)
    };});
    const {conflicts, ...rest} = records;
    return {...rest, pending: await this.kernel.pending(), conflictedActivityIds: records.intervals.filter(i => conflicts.some(c => c.intervalIds.includes(i.id))).map(i => i.activityId),
      now: this.kernel.runtime.now(), timeZone: this.kernel.runtime.timeZone, deviceId: this.kernel.runtime.deviceId};
  }
  save(input: ActivityInput, activity?: Activity) {return activity ? this.kernel.update(activity.id, input, activity.version) : this.kernel.create(input);}
  async finish(activity: Activity, action: 'COMPLETE' | 'CANCEL' | 'DELETE') {await this.kernel.finish(activity.id, action, activity.version);}
  history(filter: HistoryFilter) {return this.kernel.history(filter);}
  async timer(a: Activity, action: 'START' | 'PAUSE' | 'RESUME' | 'STOP' | 'STOP_COMPLETE'): Promise<string> {
    const snapshot = await this.snapshot();
    const session = snapshot.sessions.find(s => s.activityId === a.id && s.deviceId === snapshot.deviceId && s.state !== 'STOPPED');
    const prior = snapshot.sessions.find(s => s.state === 'RUNNING' && s.deviceId === snapshot.deviceId && s.activityId !== a.id);
    if (action === 'START') await this.kernel.start(a.id);
    else if (action === 'STOP_COMPLETE') await this.kernel.finish(a.id, 'COMPLETE', a.version);
    else {
      if (!session) throw new Error('Esta actividad no tiene una sesión abierta.');
      if (action === 'PAUSE') await this.kernel.pause(session.id);
      if (action === 'RESUME') await this.kernel.resume(session.id);
      if (action === 'STOP') await this.kernel.stop(session.id);
    }
    return prior && (action === 'START' || action === 'RESUME') ? `Se pausó ${snapshot.all.find(a => a.id === prior.activityId)?.title ?? 'la actividad anterior'}.` :
      action === 'STOP' ? 'Sesión detenida. La actividad sigue pendiente.' : action === 'STOP_COMPLETE' ? 'Actividad realizada.' : 'Tiempo actualizado.';
  }
  async capture(input: InterpreterInput, voice: boolean, scenario: 'clear' | 'mixed') {
    let request: InterpreterRequest | undefined;
    if (this.interpreterMode === 'real') {
      const storedRecent=this.environment.contextStore?.recent();
      const recent=storedRecent?.length ? storedRecent : this.recentIds;
      const details=retrieveCandidates((await this.snapshot()).all,input,recent);
      input={...input,candidates:details.map(c=>({id:c.id,version:c.version}))};
      request={input,candidateDetails:details,recentIds:recent.filter(id=>details.some(c=>c.id===id))};
      this.captures.set(input.inputId,request);
      this.environment.contextStore?.put(input.inputId,request);
    }
    const capture = this.environment.capture(scenario,request);
    const response = voice ? await capture.audio({audio: new Blob([]), context: input}, input.candidates) : await capture.text(input);
    const prepared=await new InterpreterWorkflow(this.kernel).prepare(response, input.candidates,this.interpreterMode==='real');
    if (this.environment.debug) console.debug('[interpreter]',{input,request,response,validation:'OK'});
    return prepared;
  }
  transcribe(context: CaptureContext) {return this.environment.voice.transcribe({audio: new Blob([]), context});}
  async beginVoice(context:CaptureContext) {if(!this.environment.recorder)throw new Error('Grabación no disponible.');await this.environment.recorder.start(context);}
  async finishVoice() {if(!this.environment.recorder)throw new Error('Grabación no disponible.');return this.environment.voice.transcribe(await this.environment.recorder.stop());}
  cancelVoice() {this.environment.recorder?.cancel();}
  captureDraft(voice:boolean){return this.environment.contextStore?.draft?.(voice)??{text:''};}
  saveCaptureDraft(voice:boolean,draft:{text:string;context?:CaptureContext}){this.environment.contextStore?.saveDraft?.(voice,draft);}
  async manualCapture(text:string,_context:CaptureContext){
    if(!text.trim())throw new Error('Escribe el nombre de la actividad.');
    return new InterpreterWorkflow(this.kernel).prepare({schemaVersion:'1.1',inputId:this.kernel.runtime.id(),operations:[{opId:'manual1',action:'CREATE',evidence:text.slice(0,1000),fields:{title:text.trim().slice(0,300),category:'PERSONAL',type:'TASK',dueDate:null,dueTime:null,reservedDurationMinutes:null,groupRef:null}}],clarifications:[]});
  }
  async editProposal(batch:BatchRecord,opId:string,fields:Extract<import('../../../../datos/contracts/interpreter/public').InterpreterOperation,{action:'CREATE'}>['fields']){
    const response=validateInterpreter(batch.response);
    const op=response.operations.find(op=>op.opId===opId);
    if(op?.action!=='CREATE' || batch.appliedOpIds.includes(opId))throw new Error('Esta propuesta ya no se puede editar.');
    op.fields=structuredClone(fields);
    response.clarifications=response.clarifications.map(c=>({...c,affectedOpIds:c.affectedOpIds.filter(id=>id!==opId)})).filter((c,index)=>!response.clarifications[index]!.affectedOpIds.includes(opId) || c.affectedOpIds.length>0);
    const candidates=(await this.snapshot()).all.map(a=>({id:a.id,version:a.version}));
    return new InterpreterWorkflow(this.kernel).prepare(response,candidates,this.interpreterMode==='real',batch.revision);
  }
  async apply(batch: BatchRecord) {
    const before=new Set((await this.snapshot()).all.map(a=>a.id));
    const applied=await new InterpreterWorkflow(this.kernel).applyPrepared(batch.id, batch.revision);
    const snapshot=await this.snapshot();
    const ids=validateInterpreter(batch.response).operations.filter(op=>batch.preparedOpIds.includes(op.opId)).flatMap(op=>'targetId' in op ? [op.targetId] : []);
    this.recentIds=[...new Set([...snapshot.all.filter(a=>!before.has(a.id)).map(a=>a.id),...ids])].slice(0,8);
    this.environment.contextStore?.setRecent(this.recentIds);
    if(applied.state==='APPLIED')for(const voice of [true,false]){
      const draft=this.environment.contextStore?.draft?.(voice);
      if(draft?.context?.inputId===batch.id)this.environment.contextStore?.saveDraft?.(voice,{text:''});
    }
    if(this.environment.debug) console.debug('[interpreter applied]',{batchId:applied.id,opIds:applied.appliedOpIds});
    return applied;
  }
  async resolveClarification(batch:BatchRecord,id:string,answer:string) {
    const saved=this.environment.contextStore?.get(batch.id) ?? this.captures.get(batch.id);
    if (!saved) throw new Error('No está disponible el texto de este borrador. Puedes resolver la hora o crear manualmente.');
    const previous=validateInterpreter(batch.response);
    const request:InterpreterRequest={...saved,clarification:{previous,appliedOpIds:batch.appliedOpIds,questionId:id,answer}};
    const response=await this.environment.capture('mixed',request).text(saved.input);
    return new InterpreterWorkflow(this.kernel).prepare(response,saved.input.candidates);
  }
  async resolveTime(batch: BatchRecord, clarificationId: string, time: string) {
    const response = validateInterpreter(batch.response);
    const clarification = response.clarifications.find(c => c.id === clarificationId);
    if (!clarification || clarification.reason !== 'AMBIGUOUS_TIME' || !clarification.options.includes(time) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Hora no válida para esta aclaración.');
    for (const id of clarification.affectedOpIds) {
      const op = response.operations.find(op => op.opId === id);
      if (op?.action === 'CREATE') op.fields.dueTime = time;
      else if (op?.action === 'UPDATE') op.patch.dueTime = time;
    }
    response.clarifications = response.clarifications.filter(c => c.id !== clarificationId);
    const candidates = (await this.snapshot()).all.map(a => ({id: a.id, version: a.version}));
    return new InterpreterWorkflow(this.kernel).prepare(response, candidates,this.interpreterMode==='real',batch.revision);
  }
  useDemo(reset = false) {return this.environment.switchMode('demo', reset);}
  usePersonal() {return this.environment.switchMode('personal', false);}
  exportBackup() {return exportBackup(this.kernel.uow, this.kernel.runtime);}
  async restoreBackup(text: string) {
    const result = await restoreBackup(this.kernel.uow, this.kernel.runtime, text);
    this.environment.restoredDevice?.(result.deviceId);
    return `Respaldo restaurado: ${result.count} actividades.`;
  }
}
