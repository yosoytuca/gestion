import {writeFile} from 'node:fs/promises';
import {evaluationCases,evaluateSemantics} from './ai-evaluation-cases.mjs';
const report={executedAt:new Date().toISOString(),provider:process.env.AI_PROVIDER??'openai',model:process.env.AI_MODEL??'gpt-5.4-mini',status:'NOT_RUN_NO_KEY',results:[]};
if(process.env.AI_API_KEY){
  const {RealInterpreterProvider,OpenAIProvider,GeminiProvider,GroqProvider}=await import('../server-dist/interpreter-http.mjs');
  const provider=new RealInterpreterProvider(report.provider==='groq'?new GroqProvider(process.env.AI_API_KEY,report.model):report.provider==='gemini'?new GeminiProvider(process.env.AI_API_KEY,report.model):new OpenAIProvider(process.env.AI_API_KEY,report.model));report.status='EXECUTED';
  for(const test of evaluationCases){
    const date=test.date??'2026-10-04';const candidates=test.candidates??[];
    const request={input:{inputId:crypto.randomUUID(),text:test.text,capturedAt:`${date}T12:30:00Z`,localDate:date,localTime:'07:30:00',timeZone:'America/Bogota',candidates:candidates.map(c=>({id:c.id,version:c.version}))},candidateDetails:candidates,recentIds:test.recentIds??[]};
    try{const output=await provider.interpretRequest(request);const errors=evaluateSemantics(output,test);report.results.push({text:test.text,input:request,output,errors,passed:!errors.length});console.log(`${errors.length?'FAIL':'PASS'} ${test.text}`);}
    catch(error){report.results.push({text:test.text,passed:false,errors:[error.message]});console.log(`FAIL ${test.text}: ${error.message}`);}
  }
  report.status=report.results.every(r=>r.passed)?'PASSED':'FAILED';if(report.status==='FAILED')process.exitCode=1;
}else console.log('Evaluación REAL no ejecutada: falta AI_API_KEY. Ningún caso se cuenta como aprobado.');
await writeFile('docs/ia-evaluacion-real.json',JSON.stringify(report,null,2));
