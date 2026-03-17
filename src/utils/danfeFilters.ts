import { cities } from '../data/danfes';
import { IDanfe } from '../types/types';

export type InvoiceListFilters = {
  nf: string;
  product: string;
  customer: string;
  city: string;
  route: string;
};

export type TodayInvoiceFilters = InvoiceListFilters & {
  driver: string;
  load: string;
};

function matchesInvoiceListFilters(danfe: IDanfe, filters: InvoiceListFilters) {
  const nfTerm = filters.nf.trim();
  const productTerm = filters.product.trim().toLowerCase();
  const customerTerm = filters.customer.trim().toLowerCase();
  const cityTerm = filters.city.trim().toLowerCase();

  if (nfTerm && !String(danfe.invoice_number).includes(nfTerm)) return false;

  if (productTerm) {
    const hasProduct = danfe.DanfeProducts.some((product) => (
      product.Product.code.toLowerCase().includes(productTerm)
      || product.Product.description.toLowerCase().includes(productTerm)
    ));

    if (!hasProduct) return false;
  }

  if (customerTerm && !danfe.Customer.name_or_legal_entity.toLowerCase().includes(customerTerm)) return false;
  if (cityTerm && !danfe.Customer.city.toLowerCase().includes(cityTerm)) return false;
  if (filters.route !== 'Todas' && cities[danfe.Customer.city] !== filters.route) return false;

  return true;
}

export function filterInvoiceListDanfes(dataDanfes: IDanfe[], filters: InvoiceListFilters) {
  return dataDanfes.filter((danfe) => matchesInvoiceListFilters(danfe, filters));
}

export function filterTodayInvoiceDanfes(
  dataDanfes: IDanfe[],
  driverByInvoice: Record<string, string>,
  filters: TodayInvoiceFilters,
) {
  const driverTerm = filters.driver.trim().toLowerCase();
  const loadTerm = filters.load.trim().toLowerCase();

  return dataDanfes.filter((danfe) => {
    if (!matchesInvoiceListFilters(danfe, filters)) {
      return false;
    }

    if (driverTerm) {
      const driver = String(driverByInvoice[String(danfe.invoice_number)] || '').toLowerCase();
      if (!driver.includes(driverTerm)) return false;
    }

    if (loadTerm) {
      const loadNumber = String(danfe.load_number || '').toLowerCase();
      if (loadNumber !== loadTerm) return false;
    }

    return true;
  });
}
