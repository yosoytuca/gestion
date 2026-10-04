import type {InterpreterRequest} from '../../../../datos/contracts/interpreter/transport';
import {InterpreterError,type AIProvider} from './real';
import {structuredSchema,normalizeOutput} from './structured-output';
import {interpreterInstructions} from './prompt';
/** Resolve references for Gemini's JSON Schema subset; canonical validation remains unchanged. */
export function geminiSchema():Record<string,unknown> {
  const schema=structuredSchema() as any;
  const expand=(node:any):any=>{
    if(!node || typeof node!=='object')return node;
    if(Array.isArray(node))return node.map(expand);
    if(node.$ref)return expand(schema.$defs[node.$ref.split('/').at(-1)]);
    const result:any={};
    for(const [key,value]of Object.entries(node)){
      if(['$defs','format','pattern','minLength','maxLength'].includes(key))continue;
      result[key]=key==='properties'?Object.fromEntries(Object.entries(value as any).map(([name,field])=>[name,expand(field)])):expand(value);
    }
    return result;
  };
  return expand(schema);
}
export async function geminiJSON(key:string,model:string,parts:unknown[],schema:Record<string,unknown>,instructions:string,transport:typeof fetch=fetch,timeoutMs=45000):Promise<unknown>{
  if(!key)throw new InterpreterError(503,'NOT_CONFIGURED','Configura AI_API_KEY en el servidor.');
  if(!/^gemini-[a-zA-Z0-9.-]+$/.test(model))throw new InterpreterError(503,'NOT_CONFIGURED','Modelo Gemini inválido.');
  let response:Response;
  try {response=await transport(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(timeoutMs),body:JSON.stringify({systemInstruction:{parts:[{text:instructions}]},contents:[{role:'user',parts}],generationConfig:{temperature:0,maxOutputTokens:8192,responseFormat:{text:{mimeType:'APPLICATION_JSON',schema}}}})});}
  catch {throw new InterpreterError(504,'TIMEOUT','No se pudo conectar con Gemini a tiempo. Reintenta.');}
  if(!response.ok)throw new InterpreterError(response.status===429?429:502,response.status===429?'RATE_LIMIT':response.status===403?'ACCESS_DENIED':'PROVIDER_ERROR',response.status===429?'Gemini alcanzó su límite. Espera y reintenta.':response.status===403?'Gemini denegó acceso al proyecto. Revisa el acceso en Google AI Studio.':'Gemini rechazó la solicitud. Revisa modelo, clave y acceso.');
  try {
    const data=await response.json() as any,candidate=data.candidates?.[0];
    if(candidate?.finishReason!=='STOP')throw new Error('Incomplete');
    const text=candidate.content.parts.filter((p:any)=>typeof p.text==='string' && !p.thought).map((p:any)=>p.text).join('');
    return JSON.parse(text);
  } catch {throw new InterpreterError(502,'INVALID_OUTPUT','Gemini no devolvió una respuesta completa válida. Reintenta.');}
}
export class GeminiProvider implements AIProvider {
  constructor(private readonly key:string,private readonly model='gemini-3.8-flash',private readonly transport:typeof fetch=fetch){}
  async generate(request:InterpreterRequest){return normalizeOutput(await geminiJSON(this.key,this.model,[{text:JSON.stringify(request)}],geminiSchema(),interpreterInstructions,this.transport));}
}
