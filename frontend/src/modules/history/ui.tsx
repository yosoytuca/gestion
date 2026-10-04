import {useEffect, useState} from 'preact/hooks';
import type {Activity, Category} from '../../../../datos/contracts/entities';
import {categoryLabels, type UiPort, type UiSnapshot} from '../../shared/ui-contract';
import {CategoryIcon} from '../../components/category-icon';
import {periodFilter} from './period';
export function HistoryScreen({port, snapshot, open}: {port: UiPort; snapshot: UiSnapshot; open(id: string): void}) {
  const [category, setCategory] = useState<Category | null>(null), [query, setQuery] = useState('');
  const [period, setPeriod] = useState<'ALL' | 'WEEK' | 'MONTH'>('ALL'), [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {void port.history({...periodFilter(period, snapshot.now, snapshot.timeZone),
      ...(category ? {category} : {}), query}).then(values => {if (current) {setActivities(values); setError('');}}).catch(e => {if (current) setError(String(e));});}, 120);
    return () => {current = false; clearTimeout(timer);};
  }, [category, query, period, snapshot.now, port]);
  return <div class="history-screen"><p class="subtitle">Lo que ya hiciste y lo que cambió.</p>
    <label class="search-field"><span aria-hidden="true">⌕</span><input type="search" aria-label="Buscar en historial" placeholder="Buscar actividades" value={query} onInput={e => setQuery(e.currentTarget.value)}/></label>
    <div class="history-controls"><label>Periodo<select value={period} onChange={e => setPeriod(e.currentTarget.value as typeof period)}><option value="ALL">Todo</option><option value="WEEK">Esta semana</option><option value="MONTH">Este mes</option></select></label></div>
    <nav class="filters" aria-label="Categoría del historial"><button class={`filter ${!category ? 'selected' : ''}`} aria-pressed={!category} onClick={() => setCategory(null)}>Todo</button>
      {(Object.keys(categoryLabels) as Category[]).map(c => <button class={`filter ${category === c ? 'selected' : ''}`} aria-pressed={category === c} aria-label={categoryLabels[c]} onClick={() => setCategory(c)}><CategoryIcon category={c}/></button>)}</nav>
    {error && <p role="alert">{error}</p>}
    {!activities.length ? <div class="empty"><span class="empty-mark">✓</span><h2>Tu historial empieza aquí</h2><p>Las actividades realizadas y canceladas aparecerán en esta sección.</p></div> :
      activities.map(a => <article class={`activity-card ${a.category.toLowerCase()}`} key={a.id}><button class="card-main" onClick={() => open(a.id)} aria-label={`Abrir ${a.title}`}><span class="card-icon"><CategoryIcon category={a.category}/></span><span class="card-copy"><strong>{a.title}</strong><small>{categoryLabels[a.category]}<span class={a.status === 'COMPLETED' ? 'completed-label' : ''}>{a.status === 'COMPLETED' ? 'Realizada' : 'Cancelada'}</span><span>{(a.dueDate ?? '').split('-').reverse().join('/')}</span></small></span></button></article>)}
  </div>;
}
