import type {Category} from '../../../datos/contracts/entities';
export function CategoryIcon({category, size = 25}: {category: Category; size?: number}) {
  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" class="category-icon" fill="none" stroke="#34453e" stroke-width="1.6" stroke-linejoin="round">
    {category === 'WORK' && <><path d="m8 27 3 2L25 11l-3-2Z" fill="#9d7458"/><path d="M6 8 10 4 22 7 28 14 25 17 19 11 10 10Z" fill="#77d2c8"/><path d="m8 7 11 1 6 6" stroke="#cffaf4"/><path d="m4 15 2-2 2 2-2 2Z" fill="#b3a7e7" stroke="none"/></>}
    {category === 'EDUCATION' && <><path d="m5 6 11 3 11-3v20l-11 3-11-3Z" fill="#b8cfe7"/><path d="M16 9v20M8 12l5 1M19 13l5-1M8 17l5 1M19 18l5-1"/><path d="m14 3 2-2 2 2-2 2Z" fill="#b6a0dc" stroke="none"/></>}
    {category === 'HEALTH' && <><path d="M16 10c-3-5-12-3-12 5 0 7 5 14 10 13l2-1 2 1c5 1 10-6 10-13 0-8-9-10-12-5Z" fill="#efd492"/><path d="M16 10V5m0 1c0-4 5-5 8-4-1 4-4 5-8 4" fill="#a8c9a1"/><path d="M9 14c-2 2-2 5-1 7" stroke="#fff6d6" stroke-width="2.5"/></>}
    {category === 'PERSONAL' && <><circle cx="16" cy="17" r="12" fill="#d8dbe0"/><circle cx="16" cy="17" r="9" fill="#f2f3f4"/><path d="m20 9-2 10-6 6 2-10Z" fill="#a88284"/><path d="m14 15 4 4-6 6Z" fill="#96b5be"/><path d="M13 5V2h6v3"/></>}
  </svg>;
}
