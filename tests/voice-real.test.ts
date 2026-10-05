import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import type {AddressInfo} from 'node:net';
import {createVoiceHandler} from '../backend/src/voice-http';
import {HttpVoiceProvider,BrowserVoiceRecorder} from '../frontend/src/infrastructure/providers/browser-voice';
const context=()=>({inputId:crypto.randomUUID(),capturedAt:'2026-10-04T12:30:00Z',localDate:'2026-10-04',localTime:'07:30:00',timeZone:'America/Bogota'});

test('Transcripción conserva el receptor global exigido por fetch del navegador',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  const capture=context();
  globalThis.fetch=async function(this:unknown){
    assert.equal(this,globalThis,'fetch debe ejecutarse con el contexto del navegador');
    return new Response(JSON.stringify({text:'Comprar cuaderno',context:capture}));
  } as typeof fetch;
  assert.equal((await new HttpVoiceProvider().transcribe({audio:new Blob(['test'],{type:'audio/webm'}),context:capture})).text,'Comprar cuaderno');
});
test('Audio HTTP → STT protegido → texto con contexto original; formato y origen inválidos rechazados',async t=>{
  let calls=0;const handler=createVoiceHandler({AI_API_KEY:'test-secret'},async(url,init)=>{
    calls++;assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');assert.equal((init!.headers as any).Authorization,'Bearer test-secret');const body=init!.body as FormData;assert.equal(body.get('model'),'gpt-4o-mini-transcribe');assert.equal(body.get('language'),'es');assert.equal((body.get('file') as Blob).size,4);
    return new Response(JSON.stringify({text:'Hoy cotizar pintura'}));
  });
  const server=createServer((req,res)=>{void handler(req,res);});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const input={audio:new Blob(['test'],{type:'audio/webm;codecs=opus'}),context:context()};
  const result=await new HttpVoiceProvider((path,init)=>fetch(`${url}${path}`,init)).transcribe(input);assert.equal(result.text,'Hoy cotizar pintura');assert.deepEqual(result.context,input.context);assert.equal(calls,1);
  const foreign=await fetch(`${url}/api/v1/voice/transcribe`,{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'audio/webm'},body:'test'});assert.equal(foreign.status,403);
  const invalid=await fetch(`${url}/api/v1/voice/transcribe`,{method:'POST',headers:{'Content-Type':'text/plain'},body:'test'});assert.equal(invalid.status,415);assert.equal(calls,1);
});
test('Voz: falta de clave y transcripción inválida no producen texto ni revelan errores internos',async()=>{
  const input={audio:new Blob(['test'],{type:'audio/webm'}),context:context()};
  await assert.rejects(()=>new HttpVoiceProvider(async()=>new Response(JSON.stringify({code:'NOT_CONFIGURED'}),{status:503})).transcribe(input),/AI_API_KEY/);
  await assert.rejects(()=>new HttpVoiceProvider(async()=>new Response(JSON.stringify({text:'',context:input.context}))).transcribe(input),/válida/);
  await assert.rejects(()=>new HttpVoiceProvider(async()=>{throw new Error('secret');}).transcribe(input),e=>e instanceof Error&&!e.message.includes('secret'));
});
test('Grabador pide permiso, guarda audio y libera todas las pistas; denegación muestra mensaje humano',async t=>{
  const keys=['navigator','MediaRecorder','isSecureContext'] as const,descriptors=keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)] as const);t.after(()=>{for(const[k,d]of descriptors){if(d)Object.defineProperty(globalThis,k,d);else delete (globalThis as any)[k];}});
  let stops=0;const stream={getTracks:()=>[{stop:()=>{stops++;}}]} as unknown as MediaStream;
  class Recorder {state='inactive';mimeType='audio/webm';ondataavailable?: (event:{data:Blob})=>void;onstop?:()=>void;onerror?:()=>void;static isTypeSupported(){return true;}start(){this.state='recording';}stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['audio'])});this.onstop?.();});}}
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>stream}}});Object.defineProperty(globalThis,'MediaRecorder',{configurable:true,value:Recorder});Object.defineProperty(globalThis,'isSecureContext',{configurable:true,value:true});
  const recorder=new BrowserVoiceRecorder(),capture=context();await recorder.start(capture);const audio=await recorder.stop();assert.equal(audio.audio.size,5);assert.deepEqual(audio.context,capture);assert.equal(stops,1);
  (navigator.mediaDevices as any).getUserMedia=async()=>{throw new DOMException('denied','NotAllowedError');};await assert.rejects(()=>recorder.start(context()),/Permite el micrófono/);
});
