import {LocalKernel} from './local-kernel';
import {resolveCalendar} from '../../../../datos/domain/activities/calendar';
import {localClock} from '../../../../datos/domain/activities/public';
export async function seedDemo(kernel: LocalKernel): Promise<void> {
  if (kernel.runtime.userId !== 'demo') throw new Error('Los ejemplos solo se cargan en el espacio demo.');
  await kernel.uow.write(async repositories => {
    const transactionKernel = new LocalKernel({read: work => work(repositories), write: work => work(repositories), close() {}}, kernel.runtime);
    await seedInTransaction(transactionKernel);
  });
}
async function seedInTransaction(kernel: LocalKernel): Promise<void> {
  if ((await kernel.uow.read(r => r.activities.list())).length) return;
  const today = localClock(kernel.runtime.now(), kernel.runtime.timeZone).date;
  const offset = (days: number) => {const result = resolveCalendar({kind: 'DAY_OFFSET', days}, kernel.runtime.now(), kernel.runtime.timeZone); return 'date' in result ? result.date : today;};
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const group = await kernel.createGroup('Cotizaciones para revisión');
  for (const [i, title] of ['Acrílicos', 'Pintado', 'Instalación de letreros', 'Fabricación de letreros'].entries()) {
    const activity = await kernel.create({title: `Cotización de ${title.toLowerCase()}`, category: 'WORK', type: 'TASK', dueDate: today, groupId: group.id});
    if (i === 1) await kernel.finish(activity.id, 'COMPLETE');
  }
  await kernel.create({title: 'Cita médica', category: 'HEALTH', type: 'COMMITMENT', dueDate: offset(1), dueTime: '16:00'});
  const monday = resolveCalendar({kind: 'NEXT_WEEK_WEEKDAY', weekday: 0}, kernel.runtime.now(), kernel.runtime.timeZone);
  await kernel.create({title: 'Reunión con asesor de tesis', category: 'EDUCATION', type: 'COMMITMENT', dueDate: 'date' in monday ? monday.date : null});
  await kernel.create({title: 'Enviar comprobante de pago', category: 'PERSONAL', type: 'TASK', dueDate: yesterday});
  await kernel.create({title: 'Preparar avance de tesis', category: 'EDUCATION', type: 'TASK', dueDate: offset(4)});
  await kernel.create({title: 'Revisar materiales del taller', category: 'WORK', type: 'TASK', dueDate: offset(18)});
  await kernel.create({title: 'Ordenar fotos del viaje', category: 'PERSONAL', type: 'TASK'});
  const cancelled = await kernel.create({title: 'Control dental', category: 'HEALTH', type: 'COMMITMENT', dueDate: yesterday});
  await kernel.finish(cancelled.id, 'CANCEL');
}
