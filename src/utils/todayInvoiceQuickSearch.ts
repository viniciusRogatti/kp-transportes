import { IDanfe } from '../types/types';

export type TodayInvoiceAssignment = {
  driverName: string;
  tripId: number | null;
};

export type TodayInvoiceProductMatch = {
  key: string;
  invoiceNumber: string;
  companyId: number | null;
  customerName: string;
  city: string;
  status: string;
  driverName: string;
  tripId: number | null;
  productCode: string;
  productDescription: string;
  quantity: number | string;
  unit: string;
};

const normalizeSearchText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

export function buildTodayInvoiceProductMatches(
  danfes: IDanfe[],
  searchTerm: string,
  assignmentByInvoice: Record<string, TodayInvoiceAssignment>,
): TodayInvoiceProductMatch[] {
  const normalizedTerm = normalizeSearchText(searchTerm);
  if (!normalizedTerm) return [];

  return danfes.flatMap((danfe) => {
    const invoiceNumber = String(danfe.invoice_number || '').trim();
    const assignment = assignmentByInvoice[invoiceNumber];
    return (danfe.DanfeProducts || [])
      .filter((item) => (
        normalizeSearchText(item.Product?.code).includes(normalizedTerm)
        || normalizeSearchText(item.Product?.description).includes(normalizedTerm)
      ))
      .map((item) => ({
        key: `${Number(danfe.company_id || 0)}:${invoiceNumber}:${String(item.Product?.code || '')}`,
        invoiceNumber,
        companyId: Number(danfe.company_id) || null,
        customerName: String(danfe.Customer?.name_or_legal_entity || '').trim() || '-',
        city: String(danfe.Customer?.city || '').trim() || '-',
        status: String(danfe.status || '').trim(),
        driverName: assignment?.driverName || 'Sem motorista',
        tripId: assignment?.tripId || null,
        productCode: String(item.Product?.code || '').trim(),
        productDescription: String(item.Product?.description || '').trim() || '-',
        quantity: item.quantity,
        unit: String(item.type || item.Product?.type || '').trim().toUpperCase(),
      }));
  });
}
