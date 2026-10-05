import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GeminiProvider,RealInterpreterProvider,geminiSchema} from '../backend/src/modules/interpreter/public';
import {response} from './helpers';
test('Gemini intercambiable: schema JSON actual, clave en header y contrato canónico validado',async()=>{
  const batch=response();let wire:any;
  const provider=new RealInterpreterProvider(new GeminiProvider('fake-secret','gemini-3.8-flash',async(url,init)=>{
    assert.ok(String(url).endsWith('/gemini-3.8-flash:generateContent'));assert.ok(!String(url).includes('fake-secret'));
    assert.equal((init!.headers as any)['x-goog-api-key'],'fake-secret');wire=JSON.parse(init!.body as string);
    return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(batch)}]}}]}));
  }));
  const input={inputId:batch.inputId,text:'Crear tarea ficticia',capturedAt:'2026-10-04T12:30:00Z',localDate:'2026-10-04',localTime:'07:30:00',timeZone:'America/Bogota',candidates:[]};
  assert.equal((await provider.interpret(input)).operations.length,1);
  assert.equal(wire.generationConfig.responseFormat.text.mimeType,'APPLICATION_JSON');
  const schema=geminiSchema();assert.ok(!JSON.stringify(schema).includes('"$ref"'));assert.ok(!JSON.stringify(schema).includes('"$defs"'));assert.ok(!JSON.stringify(wire).includes('fake-secret'));
});
test('Gemini rechaza acceso denegado, truncamiento y JSON inválido sin revelar errores del proveedor',async()=>{
  const input={input:{inputId:crypto.randomUUID(),text:'Crear prueba',capturedAt:'2026-10-04T12:30:00Z',localDate:'2026-10-04',localTime:'07:30:00',timeZone:'America/Bogota',candidates:[]},candidateDetails:[],recentIds:[]};
  for(const result of [new Response('secret',{status:403}),new Response(JSON.stringify({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{}'}]}}]})),new Response('not json')]){
    await assert.rejects(()=>new GeminiProvider('fake-secret','gemini-3.8-flash',async()=>result).generate(input),e=>e instanceof Error&&!e.message.includes('secret'));
  }
});
