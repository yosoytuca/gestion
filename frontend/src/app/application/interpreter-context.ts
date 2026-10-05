import type {Activity} from '../../../../datos/contracts/entities';
import type {InterpreterInput} from '../../../../datos/contracts/interpreter/public';
import type {CandidateDetails, InterpreterRequest} from '../../../../datos/contracts/interpreter/transport';
import {resolveCalendar} from '../../../../datos/domain/activities/calendar';
const normalize = (s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const tokens = (s:string)=>normalize(s).match(/[a-z0-9]{3,}/g)?.filter(w=>!['para','tengo','hacer','manana','hoy','las','del','que','con','una','por','los','mejor','pasa','cambia'].includes(w)) ?? [];
export function retrieveCandidates(activities:Activity[],input:InterpreterInput,recentIds:string[]=[]): CandidateDetails[] {
  const words = tokens(input.text), text = normalize(input.text);
  const dates = [input.localDate];
  if (text.includes('manana')) {const d=resolveCalendar({kind:'DAY_OFFSET',days:1},input.capturedAt,input.timeZone);if ('date' in d) dates.push(d.date);}
  const categories = new Set<string>();
  if (/medic|cita|salud/.test(text)) categories.add('HEALTH');
  if (/tesis|asesor|estudi/.test(text)) categories.add('EDUCATION');
  if (/cotiz|pint|ingenier|letrero/.test(text)) categories.add('WORK');
  const ranked = activities.filter(a=>!a.deletedAt).map(a=> {
    const title=normalize(a.title), matches=words.filter(w=>title.includes(w) || tokens(title).some(t=>t.slice(0,5)===w.slice(0,5))).length;
    const reference=recentIds.includes(a.id) && /ponla|ponlo|acabo|eso|mejor|recien/.test(text);
    const day=text.match(/dia\s+(\d{1,2})/)?.[1];
    const score=matches*5+(categories.has(a.category)?2:0)+(dates.includes(a.dueDate ?? '')?1:0)+(day && a.dueDate?.slice(-2)===day.padStart(2,'0')?2:0)+(a.status==='PENDING'?1:0)+(reference?20:0);
    return {a,score,relevant:matches>0 || reference || categories.has(a.category) || (/reunion/.test(text)&&title.includes('reunion'))};
  }).filter(x=>x.relevant).sort((a,b)=>b.score-a.score || b.a.updatedAt.localeCompare(a.a.updatedAt)).slice(0,8);
  return ranked.map(({a})=>({id:a.id,version:a.version,title:a.title,category:a.category,type:a.type,dueDate:a.dueDate,dueTime:a.dueTime,status:a.status,reservedDurationMinutes:a.reservedDurationMinutes,groupId:a.groupId}));
}
export interface CaptureContextStore {get(id:string):InterpreterRequest|null;put(id:string,value:InterpreterRequest):void;recent():string[];setRecent(ids:string[]):void;draft?(voice:boolean):{text:string;context?:import('../../../../datos/contracts/interpreter/public').CaptureContext};saveDraft?(voice:boolean,value:{text:string;context?:import('../../../../datos/contracts/interpreter/public').CaptureContext}):void}
