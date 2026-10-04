import type {InterpreterRequest} from '../../../../datos/contracts/interpreter/transport';
/** Small, per-workspace local capture journal; no network or database access. */
export class CaptureContextStore {
  constructor(private readonly storage:Storage,private readonly namespace:string) {}
  private read():{requests:Record<string,InterpreterRequest>;recent:string[]} {
    try {
      const value=JSON.parse(this.storage.getItem(this.namespace) ?? 'null');
      if(value && typeof value.requests==='object' && value.requests && Array.isArray(value.recent) && value.recent.every((id:unknown)=>typeof id==='string'))return value;
    } catch {}
    return {requests:{},recent:[]};
  }
  get(id:string) {return this.read().requests[id] ?? null;}
  put(id:string,value:InterpreterRequest) {
    const data=this.read();delete data.requests[id];data.requests[id]=value;
    while(Object.keys(data.requests).length>20) delete data.requests[Object.keys(data.requests)[0]!];
    try {this.storage.setItem(this.namespace,JSON.stringify(data));} catch { /* Optional journal must not block domain operations when quota is exhausted. */ }
  }
  recent() {return this.read().recent;}
  setRecent(ids:string[]) {const data=this.read();data.recent=ids.slice(0,8);try {this.storage.setItem(this.namespace,JSON.stringify(data));} catch {}}
}
