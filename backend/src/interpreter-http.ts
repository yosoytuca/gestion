import type {IncomingMessage, ServerResponse} from 'node:http';
import {InterpreterError, OpenAIProvider, RealInterpreterProvider, GeminiProvider, GroqProvider, type AIProvider} from './modules/interpreter/public';
import {createVoiceHandler} from './voice-http';
export {RealInterpreterProvider, OpenAIProvider,GeminiProvider,GroqProvider} from './modules/interpreter/public';
export function createInterpreterHandler(env: NodeJS.ProcessEnv = process.env, ai?: AIProvider) {
  const voiceHandler=createVoiceHandler(env);
  const provider = new RealInterpreterProvider(ai ?? (env.AI_PROVIDER==='groq'?new GroqProvider(env.AI_API_KEY??'',env.AI_MODEL??'openai/gpt-oss-20b'):env.AI_PROVIDER==='gemini'?new GeminiProvider(env.AI_API_KEY??'',env.AI_MODEL??'gemini-3.8-flash'):new OpenAIProvider(env.AI_API_KEY ?? '',env.AI_MODEL ?? 'gpt-5.4-mini')));
  const limits = new Map<string,{start:number;count:number}>(); let active = 0;
  return async (req: IncomingMessage,res: ServerResponse): Promise<boolean> => {
    if(await voiceHandler(req,res))return true;
    const path = new URL(req.url ?? '/','http://localhost').pathname;
    if (!path.startsWith('/api/')) return false;
    const send = (status:number,value:unknown) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    if (path === '/api/v1/interpreter/config' && req.method === 'GET') {send(200,{provider:env.AI_PROVIDER??'openai',configured:Boolean(env.AI_API_KEY),debug:env.AI_DEBUG === 'true'});return true;}
    if (path !== '/api/v1/interpreter/interpret') {send(404,{error:'Endpoint no disponible.'});return true;}
    if (req.method !== 'POST') {send(405,{error:'Usa POST.'});return true;}
    // Same-origin requests including HTTPS forwarded by VS Code. No permissive CORS.
    if (req.headers.origin) {
      let originHost; try {originHost = new URL(req.headers.origin).host;} catch {send(403,{error:'Origen inválido.'});return true;}
      const forwarded = env.AI_ALLOWED_ORIGIN;
      if (originHost !== req.headers.host && req.headers.origin !== forwarded) {send(403,{error:'Origen no permitido.'});return true;}
    }
    if (!req.headers['content-type']?.startsWith('application/json')) {send(415,{error:'Se requiere JSON.'});return true;}
    const now = Date.now(), ip = req.socket.remoteAddress ?? 'local';
    if (limits.size > 1000) for (const [key,v] of limits) if (now-v.start > 60000) limits.delete(key);
    let limit = limits.get(ip); if (!limit || now-limit.start > 60000) {limit={start:now,count:0};limits.set(ip,limit);}
    if (++limit.count > 20 || active >= 2) {send(429,{error:'La IA está ocupada. Espera un momento y reintenta.',code:'RATE_LIMIT'});return true;}
    if (env.AI_PROVIDER && !['openai','gemini','groq'].includes(env.AI_PROVIDER)) {send(503,{error:'AI_PROVIDER debe ser openai, gemini o groq.',code:'NOT_CONFIGURED'});return true;}
    active++;
    try {
      const chunks: Buffer[] = [];let bytes = 0;
      for await (const chunk of req) {bytes += chunk.length;if (bytes > 131072) throw new InterpreterError(413,'TOO_LARGE','La entrada es demasiado larga.');chunks.push(Buffer.from(chunk));}
      let request;try {request = JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw new InterpreterError(400,'INVALID_JSON','Entrada JSON inválida.');}
      const response = await provider.interpretRequest(request);
      if (env.AI_DEBUG === 'true') console.debug('[interpreter]',JSON.stringify({input:request.input,candidates:request.candidateDetails,proposal:response,validation:'OK'}));
      send(200,response);
    } catch (e) {
      const error = e instanceof InterpreterError ? e : new InterpreterError(422,'INVALID_INPUT','El texto o su contexto no son válidos.');
      console.warn('[interpreter]',error.code);
      send(error.status,{error:error.message,code:error.code});
    } finally {active--;}
    return true;
  };
}
