import { IDanfe } from '../types/types';

export function buildInvoiceContextKey(companyId: unknown, invoiceNumber: unknown) {
  return `${Number(companyId || 0) || 0}::${String(invoiceNumber || '').trim()}`;
}

export function resolveInvoiceScopedValue<T>(values: Record<string, T> | undefined, danfe: IDanfe) {
  if (!values) return undefined;
  const invoiceNumber = String(danfe.invoice_number || '').trim();
  return values[buildInvoiceContextKey(danfe.company_id, invoiceNumber)] ?? values[invoiceNumber];
}
