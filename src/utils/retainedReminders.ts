import { IDanfe, IReceiptBacklogRow } from '../types/types';

export interface RetainedReminder {
  matchType: 'customer' | 'city';
  retainedInvoiceNumber: string;
  retainedCustomerName: string;
  routeInvoiceNumbers: string[];
  city: string;
  addressLine?: string;
}

interface RetainedRowSelectionOptions {
  routeDanfes?: IDanfe[];
  retainedRows?: IReceiptBacklogRow[];
  sameDayCustomerIds?: Iterable<string>;
}

const normalizeText = (value: unknown) => String(value || '').trim();

const normalizeComparableText = (value: unknown) => normalizeText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const buildAddressLine = (customer?: IDanfe['Customer'] | null) => {
  if (!customer) return '';

  const street = normalizeText(customer.address);
  const number = normalizeText(customer.address_number);
  const neighborhood = normalizeText(customer.neighborhood);
  const city = normalizeText(customer.city);
  const state = normalizeText(customer.state);

  const streetLine = [street, number].filter(Boolean).join(', ');
  const cityLine = [city, state].filter(Boolean).join('/');

  return [streetLine, neighborhood, cityLine].filter(Boolean).join(' • ');
};

export function selectRetainedRowsForRoute({
  routeDanfes = [],
  retainedRows = [],
  sameDayCustomerIds = [],
}: RetainedRowSelectionOptions): IReceiptBacklogRow[] {
  const routeCustomerIds = new Set(
    routeDanfes.map((danfe) => normalizeText(danfe.customer_id)).filter(Boolean),
  );
  const routeCities = new Set(
    routeDanfes.map((danfe) => normalizeComparableText(danfe.Customer?.city)).filter(Boolean),
  );
  const dayCustomerIds = new Set(
    Array.from(sameDayCustomerIds, (customerId) => normalizeText(customerId)).filter(Boolean),
  );

  return retainedRows.filter((row) => {
    const customerId = normalizeText(row.customer_id);
    if (customerId && routeCustomerIds.has(customerId)) return true;
    if (customerId && dayCustomerIds.has(customerId)) return false;

    const cityKey = normalizeComparableText(row.city);
    return Boolean(cityKey) && routeCities.has(cityKey);
  });
}

export function buildRetainedReminders(
  routeDanfes: IDanfe[] = [],
  retainedRows: IReceiptBacklogRow[] = [],
  retainedDanfesByInvoice: Map<string, IDanfe> = new Map(),
): RetainedReminder[] {
  const routeInvoicesByCustomerId = new Map<string, string[]>();
  const routeCities = new Set<string>();

  routeDanfes.forEach((danfe) => {
    const customerId = normalizeText(danfe.customer_id);
    const invoiceNumber = normalizeText(danfe.invoice_number);
    const cityKey = normalizeComparableText(danfe.Customer?.city);

    if (customerId && invoiceNumber) {
      const savedInvoices = routeInvoicesByCustomerId.get(customerId) || [];
      savedInvoices.push(invoiceNumber);
      routeInvoicesByCustomerId.set(customerId, savedInvoices);
    }

    if (cityKey) routeCities.add(cityKey);
  });

  const seenInvoices = new Set<string>();
  const reminders: RetainedReminder[] = [];

  retainedRows.forEach((row) => {
    const retainedInvoiceNumber = normalizeText(row.invoice_number);
    if (!retainedInvoiceNumber || seenInvoices.has(retainedInvoiceNumber)) return;

    const customerId = normalizeText(row.customer_id);
    const routeInvoiceNumbers = customerId ? (routeInvoicesByCustomerId.get(customerId) || []) : [];
    const city = normalizeText(row.city);
    const sameCity = city ? routeCities.has(normalizeComparableText(city)) : false;

    if (!routeInvoiceNumbers.length && !sameCity) return;

    seenInvoices.add(retainedInvoiceNumber);

    if (routeInvoiceNumbers.length) {
      reminders.push({
        matchType: 'customer',
        retainedInvoiceNumber,
        retainedCustomerName: normalizeText(row.customer_name) || 'Cliente nao identificado',
        routeInvoiceNumbers,
        city,
      });
      return;
    }

    const retainedDanfe = retainedDanfesByInvoice.get(retainedInvoiceNumber);
    reminders.push({
      matchType: 'city',
      retainedInvoiceNumber,
      retainedCustomerName: normalizeText(row.customer_name)
        || normalizeText(retainedDanfe?.Customer?.name_or_legal_entity)
        || 'Cliente nao identificado',
      routeInvoiceNumbers: [],
      city: city || normalizeText(retainedDanfe?.Customer?.city),
      addressLine: buildAddressLine(retainedDanfe?.Customer),
    });
  });

  return reminders.sort((left, right) => {
    if (left.matchType !== right.matchType) {
      return left.matchType === 'customer' ? -1 : 1;
    }

    const customerCompare = left.retainedCustomerName.localeCompare(right.retainedCustomerName, 'pt-BR');
    if (customerCompare !== 0) return customerCompare;

    return left.retainedInvoiceNumber.localeCompare(right.retainedInvoiceNumber, 'pt-BR');
  });
}
