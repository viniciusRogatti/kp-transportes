import { normalizeRouteCity, UNASSIGNED_ROUTE } from './routeCatalog';
import { IDanfe, IInvoiceSearchContext } from '../types/types';
import { DanfeLegendKey, matchesDanfeLegendFilter } from './statusStyles';
import { resolveInvoiceScopedValue } from './invoiceContextKey';

export type InvoiceListFilters = {
  nf: string;
  product: string;
  customer: string;
  city: string[];
  route: string[];
  driver: string[];
  loadNumbers: string[];
  status: DanfeLegendKey | '';
};

export function createEmptyInvoiceListFilters(): InvoiceListFilters {
  return {
    nf: '',
    product: '',
    customer: '',
    city: [],
    route: [],
    driver: [],
    loadNumbers: [],
    status: '',
  };
}

const normalizeFilterText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

function resolveDanfeDriverName(
  danfe: IDanfe,
  driverByInvoice?: Record<string, string>,
  invoiceContextByNf?: Record<string, IInvoiceSearchContext>,
) {
  return String(
    resolveInvoiceScopedValue(invoiceContextByNf, danfe)?.driver_name
    || resolveInvoiceScopedValue(driverByInvoice, danfe)
    || '',
  ).trim();
}

function matchesInvoiceListFilters(
  danfe: IDanfe,
  filters: InvoiceListFilters,
  options?: {
    driverByInvoice?: Record<string, string>;
    routeByCity?: Record<string, string>;
    invoiceContextByNf?: Record<string, IInvoiceSearchContext>;
  },
) {
  const nfTerm = filters.nf.trim();
  const productTerm = normalizeFilterText(filters.product);
  const customerTerm = filters.customer.trim().toLowerCase();


  if (nfTerm && !String(danfe.invoice_number).includes(nfTerm)) return false;

  if (productTerm) {
    const hasProduct = (danfe.DanfeProducts || []).some((product) => (
      normalizeFilterText(product.Product?.code).includes(productTerm)
      || normalizeFilterText(product.Product?.description).includes(productTerm)
    ));

    if (!hasProduct) return false;
  }

  if (customerTerm && !String(danfe.Customer?.name_or_legal_entity || '').toLowerCase().includes(customerTerm)) return false;
  const cityKey = normalizeRouteCity(danfe.Customer?.city);
  if (filters.city.length && !filters.city.some((city) => normalizeRouteCity(city) === cityKey)) return false;
  if (filters.route.length && !filters.route.includes(options?.routeByCity?.[cityKey] || UNASSIGNED_ROUTE)) return false;

  if (filters.driver.length) {
    const driverName = resolveDanfeDriverName(danfe, options?.driverByInvoice, options?.invoiceContextByNf).toLowerCase();
    if (!filters.driver.some((driver) => driver.toLowerCase() === driverName)) return false;
  }

  if (filters.loadNumbers.length > 0) {
    const loadNumber = String(danfe.load_number || '').trim();
    if (!filters.loadNumbers.includes(loadNumber)) return false;
  }

  if (filters.status && !matchesDanfeLegendFilter(danfe.status, filters.status)) return false;

  return true;
}

export function filterInvoiceListDanfes(
  dataDanfes: IDanfe[],
  filters: InvoiceListFilters,
  options?: {
    driverByInvoice?: Record<string, string>;
    routeByCity?: Record<string, string>;
    invoiceContextByNf?: Record<string, IInvoiceSearchContext>;
  },
) {
  return dataDanfes.filter((danfe) => matchesInvoiceListFilters(danfe, filters, options));
}

export function filterTodayInvoiceDanfes(
  dataDanfes: IDanfe[],
  driverByInvoice: Record<string, string>,
  filters: InvoiceListFilters,
  invoiceContextByNf?: Record<string, IInvoiceSearchContext>,
  routeByCity?: Record<string, string>,
) {
  return filterInvoiceListDanfes(dataDanfes, filters, {
    driverByInvoice,
    invoiceContextByNf,
    routeByCity,
  });
}
