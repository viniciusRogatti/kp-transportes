import { IDanfe, ITrip } from '../types/types';
import { isVariableWeightSalmon } from './tripProductManifest';

export type SalmonLoadCustomerRow = {
  customerName: string;
  customerDocument: string;
  weightKg: number;
  boxQuantity: number;
  invoiceNumbers: string[];
};

export type SalmonLoadDriverGroup = {
  driverId: number;
  driverName: string;
  tripIds: number[];
  rows: SalmonLoadCustomerRow[];
};

const normalizeKey = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

const routeKey = (companyId: unknown, invoiceNumber: unknown) => (
  `${Number(companyId || 0)}::${String(invoiceNumber || '').trim()}`
);

export const calculateSalmonBoxes = (weightKg: number) => {
  const normalizedWeight = Number(weightKg || 0);
  if (!Number.isFinite(normalizedWeight) || normalizedWeight <= 0) return 0;
  return Math.max(1, Math.floor(normalizedWeight / 30));
};

export function buildSalmonLoadList(
  trips: ITrip[] = [],
  danfes: IDanfe[] = [],
): SalmonLoadDriverGroup[] {
  const danfeByRouteKey = new Map(
    danfes.map((danfe) => [routeKey(danfe.company_id, danfe.invoice_number), danfe]),
  );
  const danfesByInvoice = danfes.reduce<Map<string, IDanfe[]>>((grouped, danfe) => {
    const invoiceNumber = String(danfe.invoice_number || '').trim();
    const invoiceDanfes = grouped.get(invoiceNumber) || [];
    invoiceDanfes.push(danfe);
    grouped.set(invoiceNumber, invoiceDanfes);
    return grouped;
  }, new Map());
  const drivers = new Map<number, {
    driverName: string;
    tripIds: Set<number>;
    customers: Map<string, Omit<SalmonLoadCustomerRow, 'boxQuantity'>>;
  }>();

  trips.forEach((trip) => {
    const driverId = Number(trip.Driver?.id || trip.driver_id || 0);
    const driverName = String(trip.Driver?.name || 'Motorista nao identificado').trim();
    const driver = drivers.get(driverId) || {
      driverName,
      tripIds: new Set<number>(),
      customers: new Map<string, Omit<SalmonLoadCustomerRow, 'boxQuantity'>>(),
    };

    (trip.TripNotes || []).forEach((note) => {
      const invoiceNumber = String(note.invoice_number || '').trim();
      const danfe = danfeByRouteKey.get(routeKey(note.company_id, invoiceNumber))
        || danfesByInvoice.get(invoiceNumber)?.[0];
      if (!danfe) return;

      const salmonWeight = (danfe.DanfeProducts || []).reduce((total, product) => {
        if (!isVariableWeightSalmon(product.Product?.description, product.type || product.Product?.type)) {
          return total;
        }
        return total + Number(product.quantity || 0);
      }, 0);
      if (salmonWeight <= 0) return;
      driver.tripIds.add(Number(trip.id));

      const customerName = String(
        danfe.Customer?.name_or_legal_entity || note.customer_name || 'Cliente nao identificado',
      ).trim();
      const customerDocument = String(danfe.Customer?.cnpj_or_cpf || danfe.customer_id || '').trim();
      const customerKey = normalizeKey(customerDocument || danfe.customer_id || customerName);
      const existing = driver.customers.get(customerKey);

      if (existing) {
        existing.weightKg += salmonWeight;
        if (invoiceNumber && !existing.invoiceNumbers.includes(invoiceNumber)) {
          existing.invoiceNumbers.push(invoiceNumber);
        }
      } else {
        driver.customers.set(customerKey, {
          customerName,
          customerDocument,
          weightKg: salmonWeight,
          invoiceNumbers: invoiceNumber ? [invoiceNumber] : [],
        });
      }
    });

    if (driver.customers.size) drivers.set(driverId, driver);
  });

  return Array.from(drivers.entries())
    .map(([driverId, driver]) => ({
      driverId,
      driverName: driver.driverName,
      tripIds: Array.from(driver.tripIds).sort((left, right) => left - right),
      rows: Array.from(driver.customers.values())
        .map((row) => ({ ...row, boxQuantity: calculateSalmonBoxes(row.weightKg) }))
        .sort((left, right) => left.customerName.localeCompare(right.customerName, 'pt-BR')),
    }))
    .sort((left, right) => left.driverName.localeCompare(right.driverName, 'pt-BR'));
}
