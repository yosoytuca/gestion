import {useState,useEffect,useRef} from 'preact/hooks';
import type {BatchRecord,Activity} from '../../../../datos/contracts/entities';
import type {CaptureContext,InterpreterOperation} from '../../../../datos/contracts/interpreter/public';
import {validateInterpreter} from '../../../../datos/contracts/interpreter/validation';
import {CategoryIcon} from '../../components/category-icon';
import type {UiPort} from '../../shared/ui-contract';
import {localClock} from '../../../../datos/domain/activities/public';
import {categoryLabels} from '../../shared/ui-contract';
type ProposalFields=Extract<InterpreterOperation,{action:'CREATE'}>['fields'];
export function CaptureScreen({voice, port, context, interpret, cancel, busy,manual}: {voice: boolean; port: UiPort; context: CaptureContext;
  interpret(text: string, scenario: 'clear' | 'mixed',capturedContext?:CaptureContext): void; cancel(): void; busy: boolean; manual?(text:string,context:CaptureContext):void}) {
  const [text, setText] = useState(()=>port.captureDraft?.(voice).text??''), [scenario, setScenario] = useState<'clear' | 'mixed'>('mixed');
  const [transcribing, setTranscribing] = useState(false), [error, setError] = useState('');
  const [recording,setRecording]=useState(false),[permission,setPermission]=useState(false),[seconds,setSeconds]=useState(0);
  const [voiceContext,setVoiceContext]=useState<CaptureContext|undefined>(()=>port.captureDraft?.(voice).context);
  useEffect(()=>{port.saveCaptureDraft?.(voice,{text,context:voiceContext??context});},[text,voiceContext,port,voice,context]);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;port.cancelVoice?.();};},[port]);
  const real=port.interpreterMode === 'real';
  const stopVoice=async()=>{
    setRecording(false);setTranscribing(true);setError('');
    try{const result=await port.finishVoice!();if(!alive.current)return;setText(result.text);setVoiceContext(result.context);interpret(result.text,scenario,result.context);}
    catch(e){if(alive.current)setError(e instanceof Error?e.message:'No se pudo transcribir.');}
    finally{if(alive.current)setTranscribing(false);}
  };
  useEffect(()=>{if(!recording)return;const ticker=setInterval(()=>setSeconds(s=>s+1),1000);const end=setTimeout(()=>{void stopVoice();},120000);return()=>{clearInterval(ticker);clearTimeout(end);};},[recording]);
  return <div class="capture-screen"><p class="mock-notice">{real ? `Interpretación con IA${voice ? ' · micrófono' : ''}` : `Modo de prueba · sin IA${voice ? ' ni micrófono' : ''}`}</p>
    <p class="subtitle">{voice ? real ? 'Toca el micrófono, habla y vuelve a tocarlo para terminar. Transcribiremos e interpretaremos tu entrada.' : 'Prueba el recorrido de voz con una transcripción de ejemplo.' : 'Cuéntame lo que tienes pendiente, en una sola entrada.'}</p>
    {voice && <div class="voice-stage"><button class="mic-button" aria-label={real ? recording?'Terminar y procesar audio':'Iniciar grabación':'Simular captura de voz'} aria-pressed={recording} disabled={transcribing || busy || permission} onClick={async () => {
      setError('');
      if(real){if(recording){await stopVoice();return;}setPermission(true);try{if(!port.beginVoice || !port.finishVoice)throw new Error('Grabación no disponible.');const capturedAt=new Date().toISOString(),clock=localClock(capturedAt,context.timeZone);await port.beginVoice({...context,capturedAt,localDate:clock.date,localTime:`${clock.time}:${capturedAt.slice(17,19)}`});if(alive.current){setRecording(true);setSeconds(0);}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'No se pudo abrir el micrófono.');}finally{if(alive.current)setPermission(false);}return;}
      setTranscribing(true); try {setText((await port.transcribe(context)).text);} catch (e) {setError(String(e));} finally {setTranscribing(false);}
    }}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></button><span role="status">{permission?'Esperando permiso del micrófono…':recording?`Grabando · ${seconds}s · toca para terminar`:busy?'Interpretando…':transcribing ? real?'Transcribiendo audio…':'Procesando ejemplo…' : text ? real?'Transcripción lista':'Transcripción simulada lista' : real?'Toca para hablar':'Toca para simular voz'}</span></div>}
    <label class="field">{voice ? 'Texto obtenido' : 'Tus pendientes'}<textarea maxLength={20000} value={text} onInput={e => setText(e.currentTarget.value)} placeholder="Hoy tengo cotizaciones de pintura y acrílicos, mañana médico a las cuatro…" rows={voice ? 5 : 8}/></label>
    {!real && <label class="field compact">Ejemplo del intérprete<select value={scenario} onChange={e => setScenario(e.currentTarget.value as typeof scenario)}><option value="mixed">Cotizaciones y cita por aclarar</option><option value="clear">Cotizaciones y compromisos claros</option></select></label>}
    <p class="help">{real ? voice ? 'El audio se envía al servidor y al proveedor de IA configurado para transcribir; después se interpreta el texto con hasta 8 actividades relacionadas. Revisa la propuesta antes de guardar. Requiere conexión.' : 'Se envían el texto, la fecha de captura y hasta 8 actividades relacionadas. Revisa la propuesta antes de guardar. Sin conexión, usa Crear manualmente.' : 'El mock devuelve el ejemplo seleccionado; todavía no interpreta tu texto.'}</p>
    {error && <p role="alert">{error}</p>}
    <button class="primary save-button" disabled={!text.trim() || busy || recording || permission || transcribing} onClick={() => interpret(text, scenario,voiceContext)}>{busy ? 'Interpretando…' : 'Interpretar'}</button>
    {text && <p class="help">Tu texto se conserva en este dispositivo. Puedes editarlo y reintentar sin volver a grabar ni transcribir. Reinterpretar sí consume IA.</p>}
    {text && <button class="save-button" disabled={busy || transcribing || recording} onClick={()=>{void navigator.clipboard?.writeText(text).catch(()=>setError('Selecciona el texto para copiarlo.'));}}>Copiar texto</button>}
    {text && manual && <><button class="save-button" disabled={busy || transcribing || recording} onClick={()=>manual(text,voiceContext??context)}>Preparar manualmente sin IA</button><p class="help">Crea una propuesta editable con este texto como nombre (máximo 300 caracteres). No interpreta ni consume IA.</p></>}
    {text && <button class="save-button" disabled={busy || transcribing || recording} onClick={()=>{setText('');setVoiceContext(undefined);}}>Descartar texto guardado</button>}
    <button class="save-button" disabled={busy || transcribing} onClick={()=>{port.cancelVoice?.();cancel();}}>Cancelar</button>
  </div>;
}
export function CaptureResult({batch, apply, resolve, clarify, real, activities, busy,edit}: {batch: BatchRecord; apply(): void; resolve(id: string, time: string): void; clarify?(id:string,answer:string):void;real?:boolean;activities?:Activity[]; busy: boolean;edit?(opId:string,fields:ProposalFields):void}) {
  const response = validateInterpreter(batch.response);
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [dirty,setDirty]=useState<Record<string,boolean>>({});
  useEffect(()=>setDirty({}),[batch.revision]);
  return <div class="capture-result"><p class="mock-notice">{real ? 'Propuesta de IA · revisa antes de guardar' : 'Resultado simulado'}</p><h2>Esto quedó organizado</h2><p class="subtitle">{batch.preparedOpIds.length} listas · {response.clarifications.length} por aclarar · {batch.appliedOpIds.length} guardadas</p>
    {response.operations.filter(op => op.action !== 'CREATE_GROUP').map(op => {
      const blocked = batch.blockedOpIds.includes(op.opId), applied = batch.appliedOpIds.includes(op.opId);
      const target='targetId' in op ? activities?.find(a=>a.id===op.targetId) : undefined;
      const labels={UPDATE:'Modificar',COMPLETE:'Completar',CANCEL:'Cancelar',DELETE:'Eliminar'};
      return <div key={op.opId}><div class={`result-row ${blocked ? 'needs-clarification' : ''}`}>
        {op.action === 'CREATE' && <CategoryIcon category={op.fields.category}/>}
        <span><strong>{op.action === 'CREATE' ? op.fields.title : `${labels[op.action]} · ${target?.title ?? 'Actividad seleccionada'}`}</strong><small>{applied ? 'Guardada' : blocked ? 'Por aclarar' : 'Lista para guardar'}{op.action === 'CREATE' && <> · {op.fields.dueDate} {op.fields.dueTime}</>}{op.action==='UPDATE' && <> · {Object.entries(op.patch).map(([key,value])=>`${({dueDate:'Fecha',dueTime:'Hora',title:'Título',category:'Categoría',type:'Tipo',reservedDurationMinutes:'Duración',groupId:'Grupo'} as Record<string,string>)[key]}: ${value ?? 'sin asignar'}`).join(' · ')}</>}</small></span><span aria-hidden="true">{applied ? '✓' : blocked ? '?' : '·'}</span>
      </div>{op.action==='CREATE' && !applied && edit && <ProposalEditor key={`${op.opId}-${batch.revision}`} fields={op.fields} groups={response.operations.filter(op=>op.action==='CREATE_GROUP')} busy={busy || Object.entries(dirty).some(([id,value])=>id!==op.opId && value)} changed={value=>setDirty(current=>({...current,[op.opId]:value}))} save={fields=>edit(op.opId,fields)}/>}</div>;
    })}
    {response.clarifications.filter(c=>!c.affectedOpIds.length || c.affectedOpIds.some(id=>!batch.appliedOpIds.includes(id))).map(c => <section class="clarification" key={c.id}><strong>{c.question}</strong>
      {real && c.affectedOpIds.length>0 && c.affectedOpIds.every(id=>batch.preparedOpIds.includes(id)) && <p>Opcional: puedes guardar sin completar este dato o editarlo arriba. No se necesita otra llamada a IA.</p>}
      {c.reason === 'AMBIGUOUS_TIME' ? <div>{c.options.map(time => <button disabled={busy} onClick={() => resolve(c.id, time)}>{time}</button>)}</div> : clarify ? <div><label class="field">Tu respuesta<input value={answers[c.id] ?? ''} onInput={e=>setAnswers({...answers,[c.id]:e.currentTarget.value})}/></label>{c.options.length>0 && <p>{c.options.join(' · ')}</p>}<button disabled={busy || !answers[c.id]?.trim()} onClick={()=>clarify(c.id,answers[c.id]!)}>Aclarar</button></div> : <p>Esta aclaración necesita revisión manual.</p>}</section>)}
    {Object.values(dirty).some(Boolean) && <p>Aplica la edición de la propuesta antes de guardar las actividades.</p>}
    <button class="primary save-button" disabled={busy || !batch.preparedOpIds.length || Object.values(dirty).some(Boolean)} onClick={apply}>{busy ? 'Guardando…' : real?'Guardar actividades revisadas':'Guardar claras'}</button>
    {batch.state === 'APPLIED' && <p class="success-note">Todo guardado. Puedes volver a tus pendientes.</p>}
  </div>;
}
function ProposalEditor({fields,groups,busy,save,changed}:{fields:ProposalFields;groups:InterpreterOperation[];busy:boolean;save(fields:ProposalFields):void;changed(value:boolean):void}){
  const [draft,updateDraft]=useState(fields);
  const setDraft=(value:ProposalFields)=>{updateDraft(value);changed(JSON.stringify(value)!==JSON.stringify(fields));};
  return <details><summary>Editar propuesta</summary><form onSubmit={e=>{e.preventDefault();save(draft);}}><fieldset disabled={busy} style={{border:'none',padding:0,margin:0}}>
    <label class="field">Nombre<input required maxLength={300} value={draft.title} onInput={e=>setDraft({...draft,title:e.currentTarget.value})}/></label>
    <label class="field">Categoría<select value={draft.category} onChange={e=>setDraft({...draft,category:e.currentTarget.value as ProposalFields['category']})}>{Object.entries(categoryLabels).map(([value,label])=><option value={value}>{label}</option>)}</select></label>
    <label class="field">Tipo<select value={draft.type} onChange={e=>setDraft({...draft,type:e.currentTarget.value as ProposalFields['type'],reservedDurationMinutes:null})}><option value="TASK">Actividad</option><option value="COMMITMENT">Compromiso</option></select></label>
    <label class="field">Grupo<select value={draft.groupRef??''} onChange={e=>setDraft({...draft,groupRef:e.currentTarget.value||null})}><option value="">Sin grupo</option>{groups.map(op=>op.action==='CREATE_GROUP' && <option value={op.tempId}>{op.title}</option>)}</select></label>
    <label class="field">Fecha (opcional)<input type="date" value={draft.dueDate??''} onInput={e=>setDraft({...draft,dueDate:e.currentTarget.value||null,dueTime:e.currentTarget.value?draft.dueTime:null})}/></label>
    <label class="field">Hora (opcional)<input type="time" disabled={!draft.dueDate} value={draft.dueTime??''} onInput={e=>setDraft({...draft,dueTime:e.currentTarget.value||null})}/></label>
    <button type="submit" disabled={busy || !draft.title.trim()}>Aplicar edición sin IA</button>
  </fieldset></form></details>;
}
