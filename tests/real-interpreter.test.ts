import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import type {AddressInfo} from 'node:net';
import {OpenAIProvider,RealInterpreterProvider,validateRequest,validateProposal} from '../backend/src/modules/interpreter/public';
import {structuredSchema,normalizeOutput} from '../backend/src/modules/interpreter/structured-output';
import {createInterpreterHandler} from '../backend/src/interpreter-http';
import {RealInterpreterProvider as HttpProvider} from '../frontend/src/infrastructure/providers/real-interpreter';
import {retrieveCandidates} from '../frontend/src/app/application/interpreter-context';
import {UiController} from '../frontend/src/app/application/ui-controller';
import {CaptureService} from '../frontend/src/modules/capture/public';
import {FixtureVoiceProvider} from '../frontend/src/infrastructure/providers/mock-capture';
import {fixture,response} from './helpers';
import type {InterpreterRequest} from '../datos/contracts/interpreter/transport';
import {CaptureContextStore} from '../frontend/src/infrastructure/providers/capture-context-store';
const request = ():InterpreterRequest=>({input:{inputId:crypto.randomUUID(),text:'Hoy cotizar pintura',capturedAt:'2026-10-04T12:30:00Z',localDate:'2026-10-04',localTime:'07:30:00',timeZone:'America/Bogota',candidates:[]},candidateDetails:[],recentIds:[]});
const proposal=(r:InterpreterRequest)=>({...response(),inputId:r.input.inputId});
const envelope=(value:unknown)=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]}));
test('Diario local limitado: corrupción y cuota no bloquean captura/aplicación',()=>{
  let saved='{"requests":null,"recent":2}';let quota=false;
  const storage={getItem:()=>saved,setItem:(_key:string,value:string)=>{if(quota)throw new Error('QuotaExceeded');saved=value;}} as unknown as Storage;
  const store=new CaptureContextStore(storage,'test');assert.equal(store.get('missing'),null);
  for(let i=0;i<25;i++)store.put(String(i),request());
  assert.equal(Object.keys(JSON.parse(saved).requests).length,20);assert.equal(store.get('0'),null);assert.ok(store.get('24'));
  quota=true;assert.doesNotThrow(()=>store.put('26',request()));assert.doesNotThrow(()=>store.setRecent(['id']));
});
test('Structured output derivado conserva títulos y all-required; PATCH wire no convierte omisión en null',()=>{
  const schema=structuredSchema() as any;
  assert.ok(schema.$defs.fields.properties.title);assert.ok(schema.$defs.createGroup.properties.title);
  const check=(node:any)=>{if(!node||typeof node!=='object')return;if(node.properties){assert.deepEqual(node.required,Object.keys(node.properties));assert.equal(node.additionalProperties,false);Object.values(node.properties).forEach(check);}if(node.$defs)Object.values(node.$defs).forEach(check);if(node.items)check(node.items);if(node.anyOf)node.anyOf.forEach(check);};check(schema);
  const p:any={operations:[{action:'UPDATE',patch:[{field:'dueDate',value:'2026-10-05'}]}]};
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeOutput(p))),{operations:[{action:'UPDATE',patch:{dueDate:'2026-10-05'}}]});
  p.operations[0].patch.push({field:'dueDate',value:null});assert.throws(()=>normalizeOutput(p));
});
test('OpenAI adapter: endpoint fijo, clave solo header servidor, store false, strict schema y contexto explícito',async()=>{
  const r=request();let body:any;
  const ai=new OpenAIProvider('test-secret','gpt-5.4-mini',async(url,init)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');assert.equal((init?.headers as any).Authorization,'Bearer test-secret');body=JSON.parse(init!.body as string);return envelope(proposal(r));
  });
  const result=await new RealInterpreterProvider(ai,()=>r).interpret(r.input);
  assert.equal(result.inputId,r.input.inputId);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(JSON.parse(body.input).input.capturedAt,r.input.capturedAt);assert.ok(!body.input.includes('test-secret'));
});
test('Proveedor real rechaza JSON, refusals, truncamiento, enums, fechas y respuestas sin contrato',async()=>{
  const r=request();
  for(const output of [new Response('not-json'),new Response(JSON.stringify({status:'incomplete',output:[]})),envelope({...proposal(r),schemaVersion:'9'}),envelope({operations:[]})]) {
    await assert.rejects(()=>new RealInterpreterProvider(new OpenAIProvider('test','model',async()=>output),()=>r).interpret(r.input));
  }
  for(const mutate of [(p:any)=>p.operations[0].fields.category='OTHER',(p:any)=>p.operations[0].fields.dueDate='2026-02-30',(p:any)=>p.operations[0].fields.reservedDurationMinutes=30,(p:any)=>p.inputId=crypto.randomUUID()]){
    const p=proposal(r);mutate(p);await assert.rejects(()=>new RealInterpreterProvider({generate:async()=>p},()=>r).interpret(r.input));
  }
});
test('Sin clave, rate limit, timeout y proveedor no filtran respuestas ni secretos',async()=>{
  const r=request();await assert.rejects(()=>new OpenAIProvider('').generate(r),/AI_API_KEY/);
  for(const status of [401,429,500]) await assert.rejects(()=>new OpenAIProvider('secret','model',async()=>new Response('secret', {status})).generate(r),e=>e instanceof Error && !e.message.includes('secret'));
  await assert.rejects(()=>new OpenAIProvider('secret','model',async()=>{throw new DOMException('secret','TimeoutError');}).generate(r),/tardó/);
});
test('Entrada allowlist: contexto incoherente, demasiados candidatos y propiedades extra no salen al modelo',()=>{
  const r=request();const filtered=validateRequest({...r,secret:'must-not-send',input:{...r.input,privateData:'must-not-send'}});assert.ok(!JSON.stringify(filtered).includes('must-not-send'));
  assert.throws(()=>validateRequest({...r,input:{...r.input,localDate:'2026-10-05'}}));
  assert.throws(()=>validateRequest({...r,input:{...r.input,candidates:Array(9).fill({id:crypto.randomUUID(),version:1})}}));
});
test('Candidatos bounded, comandos seguros, versiones y PATCH de dominio',async t=>{
  const f=await fixture();t.after(()=>f.uow.close());
  const doctor=await f.kernel.create({title:'Cita médica',category:'HEALTH',type:'COMMITMENT',dueDate:'2026-10-05',dueTime:'16:00'});
  for(let i=0;i<15;i++) await f.kernel.create({title:`Inventario ajeno ${i}`,category:'PERSONAL',type:'TASK'});
  const r=request();r.input.text='La cita médica pásala para mañana';r.candidateDetails=retrieveCandidates((await f.kernel.pending()),r.input);r.input.candidates=r.candidateDetails.map(c=>({id:c.id,version:c.version}));
  assert.equal(r.candidateDetails.length,1);assert.equal(r.candidateDetails[0]!.id,doctor.id);
  const p:any={schemaVersion:'1.1',inputId:r.input.inputId,operations:[{opId:'u',action:'UPDATE',evidence:r.input.text,targetId:doctor.id,expectedVersion:1,patch:{dueTime:'17:00'}}],clarifications:[]};
  assert.deepEqual(validateProposal(p,r).operations,p.operations);
  for(const mutate of [(x:any)=>x.operations[0].targetId=crypto.randomUUID(),(x:any)=>x.operations[0].expectedVersion=2,(x:any)=>x.operations[0].patch.dueDate=null,(x:any)=>x.operations[0].patch.groupId=crypto.randomUUID()]) {const bad=structuredClone(p);mutate(bad);assert.throws(()=>validateProposal(bad,r));}
  const bounded=retrieveCandidates(Array.from({length:20},(_,i)=>({...doctor,id:crypto.randomUUID(),title:`Cita médica ${i}`})),r.input);assert.equal(bounded.length,8);
  const unknown=structuredClone(p);unknown.clarifications=[{id:'q',reason:'AMBIGUOUS_TARGET',question:'¿Cuál?',expression:'cita',affectedOpIds:['u'],candidateIds:[crypto.randomUUID()],options:[],dateRange:null}];assert.throws(()=>validateProposal(unknown,r));
});
test('HTTP real adaptador → CaptureService → workflow → IndexedDB; caída de IA conserva manual y reintento idempotente',async t=>{
  const handler=createInterpreterHandler({}, {generate:async r=>proposal(r)});
  const server=createServer((req,res)=>{void handler(req,res);});server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(()=>server.close());
  const f=await fixture();t.after(()=>f.uow.close());const voice=new FixtureVoiceProvider();
  const port=new UiController(f.kernel,{mode:'personal',interpreterMode:'real',voice,switchMode:async()=>{},capture:(_scenario,r)=>new CaptureService(new HttpProvider(input=>r??{input,candidateDetails:[],recentIds:[]},(path,init)=>fetch(`${url}${path}`,init)),voice)});
  const batch=await port.capture(request().input,false,'mixed');assert.equal((await f.kernel.pending()).length,0);
  const saved=await port.apply(batch);await port.apply(saved);assert.equal((await f.kernel.pending()).length,1);assert.equal((await f.uow.read(r=>r.outbox.list())).length,1);
  const foreign=await fetch(`${url}/api/v1/interpreter/interpret`,{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:JSON.stringify(request())});assert.equal(foreign.status,403);
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await assert.rejects(()=>port.capture(request().input,false,'mixed'),/conectar/);
  await port.save({title:'Manual sin IA',category:'PERSONAL',type:'TASK'});assert.equal((await f.kernel.pending()).length,2);
});
test('Aclaraciones preservan operaciones aplicadas y nunca aceptan un ID inventado',()=>{
  const r=request(),p=proposal(r);p.clarifications=[{id:'q',reason:'OTHER',question:'¿Cuál?',expression:'x',affectedOpIds:[],candidateIds:[],options:[],dateRange:null}];
  r.clarification={previous:p,appliedOpIds:['create-1'],questionId:'q',answer:'otra'};
  const altered=structuredClone(p);if(altered.operations[0]?.action==='CREATE')altered.operations[0].fields.title='Changed';
  assert.throws(()=>validateProposal(altered,r));assert.throws(()=>validateProposal({...p,operations:[]},r));
});
