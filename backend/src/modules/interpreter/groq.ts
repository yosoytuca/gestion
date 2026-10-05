import type {InterpreterRequest} from '../../../../datos/contracts/interpreter/transport';
import {InterpreterError,validateProposal,type AIProvider} from './real';
import {structuredSchema,normalizeOutput} from './structured-output';
import {interpreterInstructions} from './prompt';
export class GroqProvider implements AIProvider {
  constructor(private readonly key:string,private readonly model='openai/gpt-oss-20b',private readonly transport:typeof fetch=fetch){}
  async generate(request:InterpreterRequest){
    const proposal=await this.generateOnce(request,'');
    try{return validateProposal(proposal,request);}catch{
      throw new InterpreterError(502,'INVALID_OUTPUT','La propuesta no es válida. Tu texto se conserva: puedes reintentar o preparar manualmente sin IA.');
    }
  }
  private async generateOnce(request:InterpreterRequest,feedback:string){
    if(!this.key)throw new InterpreterError(503,'NOT_CONFIGURED','Configura AI_API_KEY en el servidor.');
    const calendar=Array.from({length:8},(_,offset)=>{
      const date=new Date(`${request.input.localDate}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+offset);
      return `${date.toISOString().slice(0,10)} ${new Intl.DateTimeFormat('es',{weekday:'long',timeZone:'UTC'}).format(date)}`;
    }).join('; ');
    let response:Response;
    try{response=await this.transport('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.key}`},signal:AbortSignal.timeout(45000),body:JSON.stringify({model:this.model,messages:[{role:'system',content:`${interpreterInstructions}\nCalendario local verificado: ${calendar}. HOY es ${request.input.localDate}; la fecha UTC de capturedAt NO sustituye localDate. ${feedback}`},{role:'user',content:JSON.stringify(request)}],reasoning_effort:'low',max_completion_tokens:6000,response_format:{type:'json_schema',json_schema:{name:'interpreter_batch',strict:true,schema:structuredSchema()}}})});}
    catch{throw new InterpreterError(504,'TIMEOUT','No se pudo conectar con Groq. Reintenta.');}
    if(!response.ok)throw new InterpreterError(response.status===429?429:502,response.status===429?'RATE_LIMIT':'PROVIDER_ERROR',response.status===429?'Se alcanzó la cuota de Groq. Espera y reintenta.':'Groq rechazó la solicitud. Revisa la clave y el modelo del servidor.');
    try{const data=await response.json() as any;if(data.choices?.[0]?.finish_reason!=='stop')throw new Error('Incomplete');return normalizeOutput(JSON.parse(data.choices[0].message.content));}
    catch{throw new InterpreterError(502,'INVALID_OUTPUT','Groq no devolvió una propuesta completa válida.');}
  }
}
