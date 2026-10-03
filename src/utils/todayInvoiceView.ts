import { createEmptyInvoiceListFilters, InvoiceListFilters } from './danfeFilters';
import { DANFE_STATUS_LEGEND } from './statusStyles';

export const currentOperationDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

export type TodayInvoiceView = {
  operationDate: string;
  filters: InvoiceListFilters;
  company: string;
  moreFilters: boolean;
  scrollY: number;
  savedOn: string;
};

export function todayInvoiceViewKey() {
  return `invoice-workspace:v1:${JSON.stringify(['user_login', 'company_id', 'user_permission'].map((key) => localStorage.getItem(key) || ''))}`;
}

export function readTodayInvoiceView(): TodayInvoiceView {
  const initial: TodayInvoiceView = { operationDate: currentOperationDate(), filters: createEmptyInvoiceListFilters(), company: 'all', moreFilters: false, scrollY: 0, savedOn: currentOperationDate() };
  try {
    const saved = JSON.parse(sessionStorage.getItem(todayInvoiceViewKey()) || 'null');
    if (!saved || saved.savedOn !== initial.savedOn || !/^\d{4}-\d{2}-\d{2}$/.test(saved.operationDate)) return initial;
    const filters = createEmptyInvoiceListFilters();
    for (const key of ['nf', 'product', 'customer'] as const) {
      if (typeof saved.filters?.[key] === 'string') filters[key] = saved.filters[key];
    }
    for (const key of ['city', 'route', 'driver', 'loadNumbers'] as const) {
      if (Array.isArray(saved.filters?.[key])) filters[key] = saved.filters[key].filter((item: unknown) => typeof item === 'string');
    }
    if (DANFE_STATUS_LEGEND.some((item) => item.key === saved.filters?.status)) filters.status = saved.filters.status;
    return { ...initial, operationDate: saved.operationDate, filters, company: typeof saved.company === 'string' ? saved.company : 'all', moreFilters: saved.moreFilters === true, scrollY: Number.isFinite(saved.scrollY) ? Math.max(0, saved.scrollY) : 0 };
  } catch { return initial; }
}

export function saveTodayInvoiceView(key: string, view: TodayInvoiceView) {
  try { sessionStorage.setItem(key, JSON.stringify(view)); } catch { /* Storage may be unavailable; browsing still works. */ }
}
