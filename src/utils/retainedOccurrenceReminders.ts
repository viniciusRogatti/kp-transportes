import { IOccurrence } from '../types/types';
import { RetainedReminder } from './retainedReminders';

const missingReasons = new Set(['faltou_no_carregamento', 'faltou_na_carga']);
const text = (value: unknown) => String(value ?? '').trim();

export function linkRetainedOccurrences(reminders: RetainedReminder[], occurrences: IOccurrence[]): RetainedReminder[] {
  return reminders.map(reminder => {
    const seen = new Set<number>();
    const linkedOccurrences = occurrences.filter(occurrence => {
      // Never infer company from invoice number, customer, or current route.
      if (!Number(reminder.companyId) || Number(occurrence.company_id) !== Number(reminder.companyId)) return false;
      if (text(occurrence.invoice_number) !== text(reminder.retainedInvoiceNumber)) return false;
      if (occurrence.status !== 'pending' || occurrence.resolved_at
        || (occurrence.workflow_status && occurrence.workflow_status !== 'pending_transportadora')) return false;
      if (seen.has(occurrence.id)) return false;
      seen.add(occurrence.id);
      return true;
    }).map(occurrence => {
      const items = occurrence.items?.length ? occurrence.items
        : occurrence.product_id || occurrence.product_description
          ? [{ product_id: occurrence.product_id, product_description: occurrence.product_description, quantity: occurrence.quantity, product_type: occurrence.product_type }]
          : [];
      const itemSummary = items.map(item => {
        const label = [text(item.product_id), text(item.product_description)].filter(Boolean).join(' - ') || 'Produto não identificado';
        const quantity = item.quantity != null && Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
          ? `${Number(item.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${text(item.product_type) || '(unidade não informada)'}`
          : 'quantidade não informada';
        return `${label}: ${quantity}`;
      }).join('; ');
      return {
        id: occurrence.id,
        instruction: missingReasons.has(text(occurrence.reason))
          ? `Para retirar o canhoto retido da NF ${reminder.retainedInvoiceNumber}, levar o produto faltante da ocorrência #${occurrence.id} e solicitar o canhoto após a entrega.`
          : `Canhoto retido com ocorrência aberta #${occurrence.id} na mesma NF. Conferir a pendência com a operação antes de solicitar a retirada do canhoto.`,
        itemSummary: itemSummary || 'Produtos não detalhados na ocorrência. Confirmar com a operação antes da saída.',
      };
    });
    return { ...reminder, linkedOccurrences };
  });
}
