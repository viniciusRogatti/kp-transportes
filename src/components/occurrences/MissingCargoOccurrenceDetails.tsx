import { IOccurrence } from '../../types/types';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const formatQuantity = (quantity: number, productType?: string | null) => {
  const formatted = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 3,
  }).format(Number(quantity || 0));
  return productType ? `${formatted} ${productType}` : formatted;
};

export const isMissingCargoOccurrence = (occurrence: Pick<IOccurrence, 'reason'>) => (
  String(occurrence.reason || '').trim().toLowerCase() === 'faltou_na_carga'
);

export const getMissingCargoOccurrenceValue = (occurrence: IOccurrence) => {
  const itemsTotal = Array.isArray(occurrence.items)
    ? occurrence.items.reduce((sum, item) => sum + Number(item.total_price || 0), 0)
    : 0;
  if (itemsTotal > 0) return itemsTotal;

  const occurrenceTotal = Number(occurrence.total_price || 0);
  if (occurrenceTotal > 0) return occurrenceTotal;

  const invoiceTotal = Number(occurrence.invoice_total_value || 0);
  return Number.isFinite(invoiceTotal) ? invoiceTotal : 0;
};

const getItemLabel = (productId?: string | null, description?: string | null) => {
  const normalizedId = String(productId || '').trim();
  const normalizedDescription = String(description || '').trim();
  if (normalizedId && normalizedDescription) return `${normalizedId} - ${normalizedDescription}`;
  return normalizedId || normalizedDescription || 'Item não identificado';
};

export default function MissingCargoOccurrenceDetails({ occurrence }: { occurrence: IOccurrence }) {
  if (!isMissingCargoOccurrence(occurrence)) return null;

  const items = occurrence.items?.length
    ? occurrence.items
    : occurrence.product_id || occurrence.product_description
      ? [{
        product_id: occurrence.product_id || '',
        product_description: occurrence.product_description,
        product_type: occurrence.product_type,
        quantity: Number(occurrence.quantity || 0),
      }]
      : [];

  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-warning/35 bg-warning/10 p-2.5 text-xs text-text"
      aria-label={`Dados para formulário de mercadoria faltante da NF ${occurrence.invoice_number}`}
    >
      <strong className="text-[11px] uppercase tracking-wide text-text">
        Dados para formulário de mercadoria faltante
      </strong>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <span><strong>Representante:</strong> {occurrence.representative_name || '-'}</span>
        <span><strong>Carga:</strong> {occurrence.load_number || '-'}</span>
        <span><strong>Motorista da saída:</strong> {occurrence.motorista_name || '-'}</span>
        <span><strong>Valor da ocorrência:</strong> {currencyFormatter.format(getMissingCargoOccurrenceValue(occurrence))}</span>
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-warning/25 bg-surface/75 px-2 py-1.5">
        <strong>Mercadoria faltante:</strong>
        {items.length ? items.map((item, index) => (
          <span
            key={`${occurrence.id}-${item.product_id || 'item'}-${index}`}
            className="pl-2"
          >
            {getItemLabel(item.product_id, item.product_description)}
            {' · '}
            <strong>{`Qtd: ${formatQuantity(Number(item.quantity || 0), item.product_type)}`}</strong>
          </span>
        )) : (
          <span className="pl-2">NF total</span>
        )}
      </div>
    </div>
  );
}
