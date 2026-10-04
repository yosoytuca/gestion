import {localClock} from '../../../../datos/domain/activities/public';
export function periodFilter(period: 'ALL' | 'WEEK' | 'MONTH', now: string, zone: string): {from?: string; to?: string} {
  if (period === 'ALL') return {};
  const today = localClock(now, zone).date, date = new Date(`${today}T12:00:00Z`);
  if (period === 'MONTH') return {from: `${today.slice(0, 7)}-01`, to: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)};
  const monday = date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000;
  return {from: new Date(monday).toISOString().slice(0, 10), to: new Date(monday + 6 * 86400000).toISOString().slice(0, 10)};
}
