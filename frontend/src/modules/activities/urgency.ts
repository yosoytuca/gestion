import type {Activity} from '../../../../datos/contracts/entities';
import {localClock} from '../../../../datos/domain/activities/public';
/** Calendar proximity in the user's timezone; independent of category and creation date. */
export function urgency(activity:Activity,instant:string,zone:string):{level:string;label:string}{
  if(!activity.dueDate)return {level:'undated',label:'Sin fecha'};
  const clock=localClock(instant,zone);
  const days=(Date.parse(`${activity.dueDate}T00:00:00Z`)-Date.parse(`${clock.date}T00:00:00Z`))/86400000;
  if(days<0 || (days===0 && activity.dueTime!==null && activity.dueTime<clock.time))return {level:'overdue',label:'Vencido'};
  if(days<=1)return {level:'urgent',label:days===0?'Vence hoy':'Vence mañana'};
  if(days<=3)return {level:'near',label:`Vence en ${days} días`};
  if(days<=7)return {level:'soon',label:`Vence en ${days} días`};
  return {level:'distant',label:`Vence en ${days} días`};
}
