import {test} from 'node:test';
import assert from 'node:assert/strict';
import {urgency} from '../frontend/src/modules/activities/urgency';
import type {Activity} from '../datos/contracts/entities';
test('Examen viernes progresa por días locales y conserva urgencia independiente de categoría',()=>{
  const a={dueDate:'2026-10-09',dueTime:null,category:'EDUCATION'} as Activity;
  for(const [date,level] of [['05','soon'],['06','near'],['07','near'],['08','urgent'],['09','urgent'],['10','overdue']]){
    assert.equal(urgency(a,`2026-10-${date}T15:00:00Z`,'America/Bogota').level,level);
    assert.equal(urgency({...a,category:'WORK'},`2026-10-${date}T15:00:00Z`,'America/Bogota').level,level);
  }
});
test('Sin fecha, más de una semana, hora vencida y cambio UTC respetan fecha local',()=>{
  const a={dueDate:'2026-10-09',dueTime:null} as Activity;
  assert.equal(urgency({...a,dueDate:null},'2026-10-04T12:00:00Z','America/Bogota').level,'undated');
  assert.equal(urgency({...a,dueDate:'2026-10-20'},'2026-10-04T12:00:00Z','America/Bogota').level,'distant');
  assert.equal(urgency({...a,dueTime:'09:00'},'2026-10-09T15:00:00Z','America/Bogota').level,'overdue');
  assert.equal(urgency(a,'2026-10-06T01:00:00Z','America/Bogota').level,'soon');
});
