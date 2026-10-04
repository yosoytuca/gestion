import type {Activity, Category} from '../../../../datos/contracts/entities';
import {CategoryIcon} from '../../components/category-icon';
import {categoryLabels, type UiSnapshot} from '../../shared/ui-contract';
import {categoryCounts, filterCategory, relativeDate, sections} from './presentation';
import {effectiveStatus} from '../../../../datos/domain/activities/public';
import {useState} from 'preact/hooks';

export function CategoryFilters({activities, selected, select}: {activities: Activity[]; selected: Category | null; select(value: Category | null): void}) {
  const counts = categoryCounts(activities);
  return <nav class="filters" aria-label="Filtrar por categoría">
    <button class={`filter ${selected === null ? 'selected' : ''}`} aria-pressed={selected === null} onClick={() => select(null)}>Todo <span>{counts.ALL}</span></button>
    {(Object.keys(categoryLabels) as Category[]).map(category => <button key={category} class={`filter ${category.toLowerCase()} ${selected === category ? 'selected' : ''}`}
      aria-label={`${categoryLabels[category]}: ${counts[category]} pendientes`} aria-pressed={selected === category} onClick={() => select(category)}>
      <CategoryIcon category={category}/><span>{counts[category]}</span>
    </button>)}
  </nav>;
}
export function ActivityList({snapshot, category, open, timer}: {snapshot: UiSnapshot; category: Category | null;
  open(id: string): void; timer(activity: Activity, action: 'START' | 'PAUSE' | 'RESUME'): void}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const filtered = filterCategory(snapshot.pending, category);
  if (!filtered.length) return <div class="empty"><span class="empty-mark">✓</span><h2>Un poco de espacio</h2><p>{category ? `No tienes pendientes de ${categoryLabels[category].toLowerCase()}.` : 'Tus pendientes aparecerán aquí.'}</p><p>Usa + para registrar lo que sigue.</p></div>;
  return <div class="activity-list">{sections(filtered, snapshot.now, snapshot.timeZone).map(section => {
    const blocks: {groupId: string | null; activities: Activity[]}[] = [];
    for (const a of section.activities) {
      const last = blocks.at(-1);
      if (a.groupId && last?.groupId === a.groupId) last.activities.push(a);
      else blocks.push({groupId: a.groupId, activities: [a]});
    }
    return <section key={section.name} class="temporal-section" aria-label={section.name}>
      <h2 class="section-heading">{section.name}<span>{section.activities.length}</span></h2>
      {blocks.map((block, index) => {
        const group = snapshot.groups.find(g => g.id === block.groupId);
        const progress = group ? snapshot.groupProgress[group.id] : undefined;
        const groupKey = `${section.name}:${group?.id}:${index}`;
        return <div key={block.activities[0]!.id} class={group ? 'group-block' : ''}>
          {group && <button class="group-heading" aria-expanded={!collapsed[groupKey]} onClick={() => setCollapsed({...collapsed, [groupKey]: !collapsed[groupKey]})}>
            <span><strong>{group.title}</strong><small>{progress?.cancelled ? `${progress.completed} completadas · ${progress.pending} pendientes · ${progress.cancelled} canceladas` : `${progress?.completed ?? 0}/${progress?.total ?? 0} completadas`}</small></span><span aria-hidden="true">{collapsed[groupKey] ? '›' : '⌄'}</span>
          </button>}
          {!collapsed[groupKey] && block.activities.map(a => {
            const status = effectiveStatus(a, snapshot.sessions);
            const session = snapshot.sessions.find(s => s.activityId === a.id && s.deviceId === snapshot.deviceId && s.state !== 'STOPPED');
            const action = session?.state === 'RUNNING' ? 'PAUSE' : session ? 'RESUME' : 'START';
            const label = action === 'PAUSE' ? 'Pausar' : action === 'RESUME' ? 'Continuar' : 'Iniciar';
            const date = relativeDate(a, snapshot.now, snapshot.timeZone);
            return <article key={a.id} class={`activity-card ${a.category.toLowerCase()} ${status === 'IN_PROGRESS' ? 'running' : ''}`}>
              <button class="card-main" onClick={() => open(a.id)} aria-label={`Abrir ${a.title}`}>
                <span class="card-icon"><CategoryIcon category={a.category} size={23}/></span>
                <span class="card-copy"><strong>{a.title}</strong><small><span>{categoryLabels[a.category]}</span><span class={date === 'Vencido' ? 'date overdue' : 'date'}>{date}</span>{a.dueTime && <span>{a.dueTime}</span>}{status === 'IN_PROGRESS' && <span class="running-label">En curso</span>}</small></span>
              </button>
              {a.type === 'TASK' && <button class="card-play" aria-label={`${label} ${a.title}`} onClick={() => timer(a, action)}>{action === 'PAUSE' ? 'Ⅱ' : '▶'}</button>}
            </article>;
          })}
        </div>;
      })}
    </section>;
  })}</div>;
}
