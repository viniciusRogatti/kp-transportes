import { IDanfe, IOccurrence } from '../types/types';

export interface OccurrenceReminder {
  occurrenceId: number;
  invoiceNumber: string;
  customerName: string;
  ageBusinessDays: number;
  reasonLabel: string;
  actionLabel: string;
  itemSummary: string;
  routeInvoiceNumbers: string[];
}

const normalizeCustomerId = (value: unknown) => String(value || '')
  .replace(/[^0-9a-z]/gi, '')
  .toUpperCase();

const ACTION_BY_REASON: Record<string, { reasonLabel: string; actionLabel: string } | undefined> = {
  faltou_no_carregamento: {
    reasonLabel: 'Faltou no carregamento',
    actionLabel: 'Levar ou conferir o produto faltante com o cliente.',
  },
  faltou_na_carga: {
    reasonLabel: 'Faltou na carga',
    actionLabel: 'Levar ou conferir o produto faltante com o cliente.',
  },
  produto_avariado: {
    reasonLabel: 'Produto avariado',
    actionLabel: 'Conferir a situação e avaliar o recolhimento da mercadoria.',
  },
  produto_invertido: {
    reasonLabel: 'Produto invertido',
    actionLabel: 'Conferir a troca do produto com o cliente.',
  },
  produto_sem_etiqueta_ou_data: {
    reasonLabel: 'Produto sem etiqueta ou data',
    actionLabel: 'Conferir a identificação e a data do produto com o cliente.',
  },
};

const buildItemSummary = (occurrence: IOccurrence) => {
  const items = occurrence.items || [];
  if (!items.length) return 'Ocorrencia referente a NF total.';
  return items.map((item) => {
    const product = [item.product_id, item.product_description].filter(Boolean).join(' - ');
    const quantity = `${item.quantity} ${String(item.product_type || '').trim()}`.trim();
    return `${product || 'Produto nao identificado'} (${quantity})`;
  }).join('; ');
};

export function buildOccurrenceReminders(
  routeDanfes: IDanfe[] = [],
  occurrences: IOccurrence[] = [],
): OccurrenceReminder[] {
  const routeInvoicesByCustomer = new Map<string, string[]>();
  routeDanfes.forEach((danfe) => {
    const customerId = normalizeCustomerId(danfe.customer_id);
    const invoiceNumber = String(danfe.invoice_number || '').trim();
    if (!customerId || !invoiceNumber) return;
    const invoiceNumbers = routeInvoicesByCustomer.get(customerId) || [];
    invoiceNumbers.push(invoiceNumber);
    routeInvoicesByCustomer.set(customerId, invoiceNumbers);
  });

  const seenOccurrences = new Set<number>();
  return occurrences.flatMap((occurrence) => {
    if (seenOccurrences.has(Number(occurrence.id))) return [];
    if (String(occurrence.status || '').toLowerCase() !== 'pending') return [];
    const ageBusinessDays = Math.max(0, Number(occurrence.age_business_days || 0));
    if (ageBusinessDays < 2) return [];
    const action = ACTION_BY_REASON[String(occurrence.reason || '')];
    if (!action) return [];
    const customerId = normalizeCustomerId(occurrence.customer_id);
    const routeInvoiceNumbers = routeInvoicesByCustomer.get(customerId) || [];
    if (!customerId || !routeInvoiceNumbers.length) return [];

    seenOccurrences.add(Number(occurrence.id));
    return [{
      occurrenceId: Number(occurrence.id),
      invoiceNumber: String(occurrence.invoice_number || '').trim(),
      customerName: String(occurrence.customer_name || '').trim() || 'Cliente nao identificado',
      ageBusinessDays,
      reasonLabel: action.reasonLabel,
      actionLabel: action.actionLabel,
      itemSummary: buildItemSummary(occurrence),
      routeInvoiceNumbers,
    }];
  }).sort((left, right) => (
    right.ageBusinessDays - left.ageBusinessDays
    || left.customerName.localeCompare(right.customerName, 'pt-BR')
  ));
}
