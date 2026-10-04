import type {Activity, Category} from '../../../../datos/contracts/entities';
import {localClock, temporalBucket} from '../../../../datos/domain/activities/public';
export type SectionName = 'Vencidas' | 'Hoy' | 'Mañana' | 'Próximamente' | 'Más adelante' | 'Sin fecha';
export function categoryCounts(pending: Activity[]): Record<Category | 'ALL', number> {
  const counts = {ALL: pending.length, WORK: 0, EDUCATION: 0, HEALTH: 0, PERSONAL: 0};
  for (const activity of pending) counts[activity.category]++;
  return counts;
}
export function filterCategory(activities: Activity[], category: Category | null): Activity[] {
  return category ? activities.filter(a => a.category === category) : activities;
}
export function sections(ordered: Activity[], instant: string, zone: string): {name: SectionName; activities: Activity[]}[] {
  const clock = localClock(instant, zone);
  const tomorrow = new Date(Date.parse(`${clock.date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const result: {name: SectionName; activities: Activity[]}[] = [];
  for (const activity of ordered) {
    const bucket = temporalBucket(activity, clock);
    const name: SectionName = bucket === 'OVERDUE' ? 'Vencidas' : bucket === 'TODAY' ? 'Hoy' :
      activity.dueDate === tomorrow ? 'Mañana' : bucket === 'UPCOMING' ? 'Próximamente' : bucket === 'FUTURE' ? 'Más adelante' : 'Sin fecha';
    let section = result.find(s => s.name === name);
    if (!section) {section = {name, activities: []}; result.push(section);}
    section.activities.push(activity);
  }
  return result;
}
export function relativeDate(activity: Activity, instant: string, zone: string): string {
  const clock = localClock(instant, zone), bucket = temporalBucket(activity, clock);
  if (bucket === 'UNDATED') return 'Sin fecha';
  if (bucket === 'OVERDUE') return 'Vencido';
  const delta = (Date.parse(`${activity.dueDate}T00:00:00Z`) - Date.parse(`${clock.date}T00:00:00Z`)) / 86400000;
  if (delta === 0) return 'Hoy'; if (delta === 1) return 'Mañana';
  if (delta <= 7) return `En ${delta} días`;
  return new Intl.DateTimeFormat('es', {day: 'numeric', month: 'short', timeZone: 'UTC'}).format(new Date(`${activity.dueDate}T12:00:00Z`));
}
