import type { ReceiptBag, ReceiptBagItem, ReceiptBagPendingItem, ReceiptBagListResponse } from '../services/receiptBagClosingService';

export type MissingReceiptPhoto = ReceiptBagPendingItem & { confirmation_uncertain?: boolean; needs_refresh?: boolean };
export const canonicalReceiptInvoice = (value: string) => value.trim().replace(/^0+(?=\d)/, '');
export const receiptPhotoKey = (item: MissingReceiptPhoto) => `${item.bag_id}:${item.company_id}:${canonicalReceiptInvoice(item.invoice_number)}`;

export const isPresentWithoutPhoto = (item: ReceiptBagItem, bagId: number) => item.receipt_photo_required !== false && item.has_whatsapp_photo !== true
  && (!item.confirmed_bag_id || item.confirmed_bag_id === bagId)
  && (['confirmed', 'recovered'].includes(item.status)
    || (item.status === 'resolved_elsewhere' && item.confirmed_bag_id === bagId));

export const missingPhotosInBag = (bag: ReceiptBag) => bag.items.filter(item => isPresentWithoutPhoto(item, bag.id));

export const photoEntryFromBag = (bag: ReceiptBag, item: ReceiptBagItem): MissingReceiptPhoto => ({
  item_id: item.id, bag_id: bag.id, trip_id: bag.trip_id,
  company_id: item.company_id || 0, invoice_number: item.invoice_number,
  customer_name: item.customer_name, city: item.city, status: item.status,
  has_whatsapp_photo: item.has_whatsapp_photo === true, receipt_photo_required: item.receipt_photo_required, confirmed_at: item.confirmed_at,
  operation_date: bag.operation_date, driver: bag.driver,
  company: item.company_id === bag.company?.id ? bag.company : null,
});

export const uniquePhotoPendencies = (items: MissingReceiptPhoto[]) => Array.from(
  new Map(items.map(item => [receiptPhotoKey(item), item])).values(),
);

export const reconcileBagPhotoPendencies = (items: MissingReceiptPhoto[], bag: ReceiptBag) => uniquePhotoPendencies([
  ...items.filter(item => item.bag_id !== bag.id),
  ...missingPhotosInBag(bag).map(item => photoEntryFromBag(bag, item)),
]);

// Usa a resposta da ação: confirmar um papel não deve disparar nova varredura global.
export const mergeBagIntoList = (data: ReceiptBagListResponse | null, bag: ReceiptBag): ReceiptBagListResponse | null => {
  if (!data) return data;
  const own = bag.items.filter(item => ['pending', 'absent'].includes(item.status)
    && !item.is_suggested_extra && item.origin_bag_id === bag.id).map(item => photoEntryFromBag(bag, item));
  const missing = missingPhotosInBag(bag).map(item => photoEntryFromBag(bag, item));
  const represented = new Set(bag.items.filter(item => item.confirmed_bag_id === bag.id || item.receipt_photo_required === false)
    .map(item => `${item.company_id}:${canonicalReceiptInvoice(item.invoice_number)}`));
  const keep = (item: ReceiptBagPendingItem) => item.bag_id !== bag.id
    && !represented.has(`${item.company_id}:${canonicalReceiptInvoice(item.invoice_number)}`);
  const pending_items = uniquePhotoPendencies([...data.pending_items.filter(keep), ...own, ...missing]);
  const rows = data.rows.map(row => row.bag_id === bag.id ? { ...row, status: bag.status, counts: bag.counts,
    completed_at: bag.completed_at, started_at: bag.started_at,
    is_overdue: bag.status !== 'completed' && bag.operation_date < data.operational_date } : row);
  return { ...data, rows, pending_items,
    missing_photo_items: uniquePhotoPendencies([...(data.missing_photo_items || []).filter(keep), ...missing]),
    summary: { ...data.summary, bags: rows.length, expected: rows.reduce((n, row) => n + row.counts.expected, 0),
      confirmed: rows.reduce((n, row) => n + row.counts.confirmed, 0), pending_receipts: pending_items.length,
      overdue_bags: rows.filter(row => row.is_overdue).length, completed_bags: rows.filter(row => row.status === 'completed').length,
      divergent_bags: rows.filter(row => row.status === 'completed_with_pending').length } };
};
