import {IndexedDbUnitOfWork} from '../infrastructure/storage/indexeddb';
import {LocalKernel} from './application/local-kernel';
import {InterpreterWorkflow} from './application/interpreter-workflow';
import {effectiveStatus} from '../../../datos/domain/activities/public';
import type {Activity, ActivityInput, BatchRecord} from '../../../datos/contracts/entities';

const uow = await IndexedDbUnitOfWork.open('gestor-local-demo');
const deviceId = localStorage.getItem('gestor-device') ?? crypto.randomUUID();
localStorage.setItem('gestor-device', deviceId);
const kernel = new LocalKernel(uow, {userId: 'local-demo', deviceId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  now: () => new Date().toISOString(), id: () => crypto.randomUUID()});
const interpreter = new InterpreterWorkflow(kernel);
const form = document.querySelector<HTMLFormElement>('#manual')!;
const message = document.querySelector<HTMLElement>('#message')!;
let editing: Activity | null = null;
let batch: BatchRecord | null = null;
function field(name: string) {return form.elements.namedItem(name) as HTMLInputElement;}
async function run(work: () => Promise<unknown>) {
  try {await work(); message.textContent = 'Guardado localmente.'; await render();}
  catch (error) {message.textContent = error instanceof Error ? error.message : String(error);}
}
form.onsubmit = event => {
  event.preventDefault();
  const input = {title: field('title').value, category: field('category').value, type: field('type').value,
    dueDate: field('dueDate').value || null, dueTime: field('dueTime').value || null} as ActivityInput;
  void run(async () => {if (editing) await kernel.update(editing.id, input, editing.version); else await kernel.create(input);
    editing = null; form.reset();});
};
document.querySelector<HTMLButtonElement>('#new')!.onclick = () => {editing = null; form.reset();};
function button(label: string, action: () => Promise<unknown> | void): HTMLButtonElement {
  const element = document.createElement('button'); element.textContent = label;
  element.onclick = () => {void run(async () => action());}; return element;
}
async function render() {
  const sessions = await uow.read(async r => (await r.sessions.list()).filter(s => s.userId === kernel.runtime.userId));
  const draw = async (container: HTMLElement, activities: Activity[]) => {
    container.replaceChildren();
    for (const a of activities) {
      const card = document.createElement('article'), title = document.createElement('strong'), detail = document.createElement('small');
      title.textContent = a.title;
      const time = await kernel.time(a.id, true);
      detail.textContent = `${a.category} · ${a.dueDate ?? 'Sin fecha'} ${a.dueTime ?? ''} · ${effectiveStatus(a, sessions)} · ${time.milliseconds === null ? 'Tiempo en conflicto' : Math.floor(time.milliseconds / 1000) + ' s activos'}`;
      card.append(title, detail);
      if (a.status === 'PENDING') {
        card.append(button('Editar', () => {editing = a; for (const key of ['title', 'category', 'type', 'dueDate', 'dueTime']) field(key).value = String(a[key as keyof Activity] ?? ''); form.scrollIntoView();}));
        if (a.type === 'TASK') {
          const s = sessions.find(s => s.activityId === a.id && s.deviceId === deviceId && s.state !== 'STOPPED');
          card.append(button(s?.state === 'RUNNING' ? 'Pausar' : s ? 'Continuar' : 'Iniciar', () => s?.state === 'RUNNING' ? kernel.pause(s.id) : s ? kernel.resume(s.id) : kernel.start(a.id)));
          if (s) card.append(button('Detener', () => kernel.stop(s.id)));
        }
        card.append(button('Completar', () => kernel.finish(a.id, 'COMPLETE', a.version)), button('Cancelar', () => kernel.finish(a.id, 'CANCEL', a.version)));
      }
      card.append(button('Eliminar', () => kernel.finish(a.id, 'DELETE', a.version))); container.append(card);
    }
  };
  await draw(document.querySelector('#pending')!, await kernel.pending());
  await draw(document.querySelector('#history')!, await kernel.history({query: document.querySelector<HTMLInputElement>('#search')!.value}));
  const pending = await uow.read(async r => (await r.outbox.list()).filter(op => op.userId === kernel.runtime.userId && op.state === 'PENDING'));
  document.querySelector('#outbox')!.textContent = `${pending.length} operaciones pendientes. No hay servidor conectado.`;
}
document.querySelector<HTMLInputElement>('#search')!.oninput = () => {void render();};
document.querySelector<HTMLButtonElement>('#prepare')!.onclick = () => {void run(async () => {
  const candidates = (await kernel.pending()).map(a => ({id: a.id, version: a.version}));
  batch = await interpreter.prepare(JSON.parse(document.querySelector<HTMLTextAreaElement>('#json')!.value), candidates);
  document.querySelector('#batch')!.textContent = JSON.stringify(batch, null, 2);
});};
document.querySelector<HTMLButtonElement>('#apply')!.onclick = () => {void run(async () => {
  if (!batch) throw new Error('Primero prepara una respuesta simulada.');
  batch = await interpreter.applyPrepared(batch.id, batch.revision);
  document.querySelector('#batch')!.textContent = JSON.stringify(batch, null, 2);
});};
document.addEventListener('visibilitychange', () => {if (!document.hidden) void render();});
if ('serviceWorker' in navigator) void navigator.serviceWorker.register('./sw.js').catch(error => {message.textContent = `Sin caché offline: ${String(error)}`;});
await render();
