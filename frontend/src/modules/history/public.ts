import type {HistoryFilter} from '../../../../datos/contracts/entities';
import type {Repositories} from '../../../../datos/contracts/repositories/public';
import {assert, localClock, validDate} from '../../../../datos/domain/activities/public';
export type {HistoryFilter} from '../../../../datos/contracts/entities';
export {HistoryScreen} from './ui';
export {periodFilter} from './period';
export async function queryHistory(r: Repositories, userId: string, timeZone: string, filter: HistoryFilter = {}) {
  assert((!filter.from || validDate(filter.from)) && (!filter.to || validDate(filter.to)) &&
    (!filter.from || !filter.to || filter.from <= filter.to), 'INVALID_PERIOD', 'Periodo inválido.');
  const normalized = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  return (await r.activities.list()).filter(a => {
    const endedAt = a.completedAt ?? a.cancelledAt;
    const date = endedAt ? localClock(endedAt, timeZone).date : '';
    return a.userId === userId && !a.deletedAt && a.status !== 'PENDING' &&
      (!filter.status || a.status === filter.status) && (!filter.category || a.category === filter.category) &&
      (!filter.from || date >= filter.from) && (!filter.to || date <= filter.to) &&
      (!filter.query || normalized(a.title).includes(normalized(filter.query)));
  }).sort((a, b) => (b.completedAt ?? b.cancelledAt ?? '').localeCompare(a.completedAt ?? a.cancelledAt ?? ''));
}
