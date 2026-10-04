import {useState} from 'preact/hooks';
import {Categories, type Activity, type ActivityGroup, type ActivityInput, type ActivityType, type Category} from '../../../../datos/contracts/entities';
import {categoryLabels} from '../../shared/ui-contract';
import {CategoryIcon} from '../../components/category-icon';
import type {ComponentChildren} from 'preact';

export interface PickerRequest {type: 'date' | 'time'; value: string | null; commit(value: string | null): void}
export function ActivityEditor({activity, groups, picker, save, children, busy}: {activity?: Activity; groups: ActivityGroup[]; picker(request: PickerRequest): void;
  save(input: ActivityInput): void; children?: ComponentChildren; busy: boolean}) {
  const [title, setTitle] = useState(activity?.title ?? ''), [category, setCategory] = useState<Category>(activity?.category ?? 'WORK');
  const [type, setType] = useState<ActivityType>(activity?.type ?? 'TASK');
  const [date, setDate] = useState(activity?.dueDate ?? null), [time, setTime] = useState(activity?.dueTime ?? null);
  const [groupId, setGroupId] = useState(activity?.groupId ?? null);
  const editable = !activity || activity.status === 'PENDING';
  return <form class="editor" onSubmit={event => {event.preventDefault(); save({title, category, type, dueDate: date, dueTime: time, groupId,
    reservedDurationMinutes: type === 'COMMITMENT' ? activity?.reservedDurationMinutes ?? null : null});}}>
    <label class="field">Nombre<input name="title" value={title} onInput={e => setTitle(e.currentTarget.value)} required maxLength={300} placeholder="¿Qué tienes pendiente?" disabled={!editable}/></label>
    <fieldset class="category-selector" disabled={!editable}><legend>Categoría</legend><div>{Categories.map(c => <button type="button" class={`${c.toLowerCase()} ${category === c ? 'chosen' : ''}`} aria-label={categoryLabels[c]} aria-pressed={category === c} onClick={() => setCategory(c)}><CategoryIcon category={c} size={29}/><span>{categoryLabels[c]}</span></button>)}</div></fieldset>
    <fieldset class="type-selector" disabled={!editable}><legend>Tipo</legend><div><button type="button" aria-pressed={type === 'TASK'} class={type === 'TASK' ? 'chosen' : ''} onClick={() => setType('TASK')}>Tarea</button><button type="button" aria-pressed={type === 'COMMITMENT'} class={type === 'COMMITMENT' ? 'chosen' : ''} onClick={() => setType('COMMITMENT')}>Compromiso</button></div></fieldset>
    <div class="date-fields"><label>Fecha<button type="button" disabled={!editable} onClick={() => picker({type: 'date', value: date, commit: setDate})}>{date ? date.split('-').reverse().join('/') : 'Sin fecha'} <span aria-hidden="true">▦</span></button></label>
      <label>Hora<button type="button" disabled={!editable} onClick={() => picker({type: 'time', value: time, commit: setTime})}>{time ?? 'Sin hora'} <span aria-hidden="true">◷</span></button></label></div>
    {!date && time && <p class="field-error" role="alert">La hora necesita una fecha. Selecciónala o limpia la hora.</p>}
    {groups.length > 0 && <label class="field compact">Grupo<select value={groupId ?? ''} disabled={!editable} onChange={e => setGroupId(e.currentTarget.value || null)}><option value="">Sin grupo</option>{groups.map(g => <option value={g.id}>{g.title}</option>)}</select></label>}
    {editable && <button class="primary save-button" type="submit" disabled={busy || !title.trim() || Boolean(time && !date)}>{busy ? 'Guardando…' : activity ? 'Guardar cambios' : 'Crear actividad'}</button>}
    {children}
  </form>;
}
