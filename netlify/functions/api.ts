import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {createInterpreterHandler} from '../../backend/src/interpreter-http';
const handle=createInterpreterHandler();
/** Netlify's buffered function transport; reuse the validated web endpoints. */
export async function handler(event:{path:string;httpMethod:string;headers:Record<string,string>;body:string|null;isBase64Encoded:boolean}){
  const body=Buffer.from(event.body??'',event.isBase64Encoded?'base64':'utf8');
  const req=Readable.from(body.length?[body]:[]) as IncomingMessage;
  req.url=event.path.replace(/^\/\.netlify\/functions\/api/,'/api');
  req.method=event.httpMethod;
  req.headers=Object.fromEntries(Object.entries(event.headers).map(([k,v])=>[k.toLowerCase(),v]));
  Object.defineProperty(req,'socket',{value:{remoteAddress:req.headers['x-nf-client-connection-ip']??'netlify'}});
  let statusCode=200;let headers:Record<string,string>={};let result='';
  const res={writeHead(status:number,value:Record<string,string>){statusCode=status;headers=value;},end(value?:string){result=value??'';}} as unknown as ServerResponse;
  if(!await handle(req,res)){statusCode=404;result='No encontrado';}
  return {statusCode,headers,body:result};
}
