import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,response} from './helpers';
import {InterpreterWorkflow} from '../frontend/src/app/application/interpreter-workflow';
import {UiController} from '../frontend/src/app/application/ui-controller';
import {FixtureVoiceProvider} from '../frontend/src/infrastructure/providers/mock-capture';
test('Revisión real permite guardar CREATE con hora ambigua vacía, sin cambiar la política de objetivos ambiguos',async t=>{
  const f=await fixture();t.after(()=>f.uow.close());const workflow=new InterpreterWorkflow(f.kernel);
  const batch=response();batch.clarifications=[{id:'time',reason:'AMBIGUOUS_TIME',question:'¿AM o PM?',expression:'a las cuatro',affectedOpIds:['create-1'],candidateIds:[],options:['04:00','16:00'],dateRange:null}];
  const prepared=await workflow.prepare(batch,[],true);assert.deepEqual(prepared.blockedOpIds,[]);
  await workflow.applyPrepared(prepared.id,prepared.revision);assert.equal((await f.kernel.pending())[0]!.dueTime,null);
  const unknown=response();unknown.clarifications=[{...batch.clarifications[0]!,reason:'AMBIGUOUS_TARGET'}];
  assert.ok((await workflow.prepare(unknown,[],true)).blockedOpIds.includes('create-1'));
});
test('Edición de propuesta y alternativa manual no llaman IA; sin fecha/hora se guardan y revisiones viejas se rechazan',async t=>{
  const f=await fixture();t.after(()=>f.uow.close());
  const controller=new UiController(f.kernel,{mode:'personal',interpreterMode:'real',voice:new FixtureVoiceProvider(),capture(){throw new Error('No debe llamar IA');},async switchMode(){}});
  const context={inputId:crypto.randomUUID(),capturedAt:f.runtime.now(),localDate:'2026-10-03',localTime:'10:00:00',timeZone:'America/Bogota'};
  const batch=await controller.manualCapture('Texto recuperado',context);
  const op=response().operations[0]!;assert.equal(op.action,'CREATE');if(op.action!=='CREATE')throw new Error();
  const fields={...op.fields,title:'Visita pendiente',category:'WORK' as const,type:'COMMITMENT' as const,dueDate:null,dueTime:null};
  const edited=await controller.editProposal(batch,'manual1',fields);
  await assert.rejects(()=>controller.editProposal(batch,'manual1',fields),/borrador cambió/);
  await controller.apply(edited);const activities=await f.kernel.pending();assert.equal(activities.length,1);assert.equal(activities[0]!.title,'Visita pendiente');assert.equal(activities[0]!.dueDate,null);
});
