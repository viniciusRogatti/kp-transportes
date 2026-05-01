import { cities } from '../data/danfes';
import { IDanfe, IInvoiceSearchContext } from '../types/types';
import { DanfeLegendKey, matchesDanfeLegendFilter } from './statusStyles';

export type InvoiceListFilters = {
  nf: string;
  product: string;
  customer: string;
  city: string;
  route: string;
  driver: string;
  loadNumbers: string[];
  status: DanfeLegendKey | '';
};

export function createEmptyInvoiceListFilters(): InvoiceListFilters {
  return {
    nf: '',
    product: '',
    customer: '',
    city: '',
    route: 'Todas',
    driver: '',
    loadNumbers: [],
    status: '',
  };
}

function resolveDanfeDriverName(
  danfe: IDanfe,
  driverByInvoice?: Record<string, string>,
  invoiceContextByNf?: Record<string, IInvoiceSearchContext>,
) {
  const invoiceNumber = String(danfe.invoice_number || '').trim();
  return String(
    driverByInvoice?.[invoiceNumber]
    || invoiceContextByNf?.[invoiceNumber]?.driver_name
    || '',
  ).trim();
}

function matchesInvoiceListFilters(
  danfe: IDanfe,
  filters: InvoiceListFilters,
  options?: {
    driverByInvoice?: Record<string, string>;
    invoiceContextByNf?: Record<string, IInvoiceSearchContext>;
  },
) {
  const nfTerm = filters.nf.trim();
  const productTerm = filters.product.trim().toLowerCase();
  const customerTerm = filters.customer.trim().toLowerCase();
  const cityTerm = filters.city.trim().toLowerCase();
  const driverTerm = filters.driver.trim().toLowerCase();

  if (nfTerm && !String(danfe.invoice_number).includes(nfTerm)) return false;

  if (productTerm) {
    const hasProduct = (danfe.DanfeProducts || []).some((product) => (
      String(product.Product?.code || '').toLowerCase().includes(productTerm)
      || String(product.Product?.description || '').toLowerCase().includes(productTerm)
    ));

    if (!hasProduct) return false;
  }

  if (customerTerm && !String(danfe.Customer?.name_or_legal_entity || '').toLowerCase().includes(customerTerm)) return false;
  if (cityTerm && !String(danfe.Customer?.city || '').toLowerCase().includes(cityTerm)) return false;
  if (filters.route !== 'Todas' && cities[String(danfe.Customer?.city || '')] !== filters.route) return false;

  if (driverTerm) {
    const driverName = resolveDanfeDriverName(danfe, options?.driverByInvoice, options?.invoiceContextByNf).toLowerCase();
    if (!driverName.includes(driverTerm)) return false;
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
) {
  return filterInvoiceListDanfes(dataDanfes, filters, {
    driverByInvoice,
    invoiceContextByNf,
  });
}
