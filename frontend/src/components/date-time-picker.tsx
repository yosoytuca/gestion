import {useState} from 'preact/hooks';
import {Sheet} from './sheet';
import {validDate} from '../../../datos/domain/activities/public';

function shiftedMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
export function DatePicker({value, today, close, confirm}: {value: string | null; today: string; close(): void; confirm(value: string | null): void}) {
  const [month, setMonth] = useState((value ?? today).slice(0, 7)), [selected, setSelected] = useState(value);
  const date = new Date(`${month}-01T12:00:00Z`), offset = (date.getUTCDay() + 6) % 7;
  const days = new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getDate();
  const title = new Intl.DateTimeFormat('es', {month: 'long', year: 'numeric', timeZone: 'UTC'}).format(date);
  return <Sheet title="Fecha" close={close}><div class="picker-month"><button aria-label="Mes anterior" onClick={() => setMonth(shiftedMonth(month, -1))}>‹</button><strong aria-live="polite">{title}</strong><button aria-label="Mes siguiente" onClick={() => setMonth(shiftedMonth(month, 1))}>›</button></div>
    <div class="calendar" role="group" aria-label={title}>
      {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, i) => <span key={i} class="weekday" aria-hidden="true">{day}</span>)}
      {Array.from({length: offset}, (_, i) => <span key={`empty-${i}`}/>)}
      {Array.from({length: days}, (_, i) => {const day = `${month}-${String(i + 1).padStart(2, '0')}`; return <button key={day} class={`${day === selected ? 'chosen' : ''} ${day === today ? 'today' : ''}`} aria-label={`Seleccionar ${day}`} aria-pressed={day === selected} onClick={() => setSelected(day)}>{i + 1}</button>;})}
    </div><div class="picker-actions"><button onClick={() => setSelected(null)}>Limpiar</button><button onClick={close}>Cancelar</button><button class="primary" onClick={() => {if (selected === null || validDate(selected)) confirm(selected);}}>Confirmar</button></div>
  </Sheet>;
}
export function TimePicker({value, close, confirm}: {value: string | null; close(): void; confirm(value: string | null): void}) {
  const [hour, setHour] = useState(value?.slice(0, 2) ?? '09'), [minute, setMinute] = useState(value?.slice(3) ?? '00');
  const [cleared, setCleared] = useState(false);
  return <Sheet title="Hora · 24 horas" close={close}>
    <div class="time-select"><label>Hora<select aria-label="Seleccionar hora" value={hour} onChange={e => {setHour(e.currentTarget.value); setCleared(false);}}>{Array.from({length: 24}, (_, i) => <option value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>)}</select></label><span>:</span><label>Minutos<select aria-label="Seleccionar minutos" value={minute} onChange={e => {setMinute(e.currentTarget.value); setCleared(false);}}>{Array.from({length: 60}, (_, i) => <option value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>)}</select></label></div>
    <p class="picker-preview">{cleared ? 'Sin hora' : `${hour}:${minute}`}</p>
    <div class="picker-actions"><button onClick={() => setCleared(true)}>Limpiar</button><button onClick={close}>Cancelar</button><button class="primary" onClick={() => confirm(cleared ? null : `${hour}:${minute}`)}>Confirmar</button></div>
  </Sheet>;
}
