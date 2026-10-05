import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GroqProvider,RealInterpreterProvider} from '../backend/src/modules/interpreter/public';
import {response} from './helpers';
test('Groq usa schema estricto y valida la propuesta sin enviar la clave en el cuerpo',async()=>{
  const batch=response();let wire:any;
  const ai=new GroqProvider('fake-secret','openai/gpt-oss-20b',async(url,init)=>{
    assert.equal(String(url),'https://api.groq.com/openai/v1/chat/completions');
    assert.equal((init!.headers as any).Authorization,'Bearer fake-secret');wire=JSON.parse(init!.body as string);
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(batch)}}]}));
  });
  const input={inputId:batch.inputId,text:'Crear prueba',capturedAt:'2026-10-04T12:30:00Z',localDate:'2026-10-04',localTime:'07:30:00',timeZone:'America/Bogota',candidates:[]};
  assert.equal((await new RealInterpreterProvider(ai).interpret(input)).operations.length,1);
  assert.equal(wire.response_format.json_schema.strict,true);assert.ok(!JSON.stringify(wire).includes('fake-secret'));
});
test('Groq rechaza cuota agotada y salida incompleta sin revelar el cuerpo remoto',async()=>{
  for(const reply of [new Response('fake-secret',{status:429}),new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{}'}}]}))]){
    await assert.rejects(()=>new GroqProvider('fake-secret',undefined,async()=>reply).generate({} as any),e=>e instanceof Error&&!e.message.includes('fake-secret'));
  }
});

test('Groq no reintenta automáticamente un lote inválido y usa calendario local',async()=>{
  const batch=response();let calls=0;
  const provider=new GroqProvider('fake-secret',undefined,async(_url,init)=>{
    const wire=JSON.parse(init!.body as string);
    assert.match(wire.messages[0].content,/2026-10-07 miércoles/);
    calls++;
    const value=calls===1?{...batch,inputId:crypto.randomUUID()}:batch;
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}));
  });
  const input={inputId:batch.inputId,text:'Ejemplo ficticio',capturedAt:'2026-10-05T00:07:00Z',localDate:'2026-10-04',localTime:'19:07:00',timeZone:'America/Bogota',candidates:[]};
  await assert.rejects(()=>new RealInterpreterProvider(provider).interpret(input),/propuesta no es válida/);
  assert.equal(calls,1);
});
