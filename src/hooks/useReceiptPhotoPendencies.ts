import { useCallback, useRef, useState } from 'react';
import type { ReceiptBag, ReceiptBagListResponse } from '../services/receiptBagClosingService';
import { canonicalReceiptInvoice, reconcileBagPhotoPendencies, uniquePhotoPendencies } from '../utils/receiptPhotoPendencies';
import type { MissingReceiptPhoto } from '../utils/receiptPhotoPendencies';

type Snapshot = { version: 1; items: MissingReceiptPhoto[]; saved_at: string | null; synced_at: string | null };
const emptySnapshot = (): Snapshot => ({ version: 1, items: [], saved_at: null, synced_at: null });
export const receiptPhotoStorageKey = () => {
  const company = localStorage.getItem('company_id');
  const login = localStorage.getItem('user_login');
  return company && login ? `kp-receipt-photos-v1:${encodeURIComponent(company)}:${encodeURIComponent(login)}` : null;
};

const readSnapshot = (key: string | null): Snapshot => {
  if (!key) return emptySnapshot();
  const raw = localStorage.getItem(key);
  if (!raw) return emptySnapshot();
  const parsed = JSON.parse(raw);
  if (parsed.version !== 1 || !Array.isArray(parsed.items) || !parsed.items.every((item: MissingReceiptPhoto) => (
    Number.isInteger(item.bag_id) && item.bag_id > 0 && Number.isInteger(item.company_id)
    && Number.isInteger(item.item_id) && Number.isInteger(item.trip_id)
    && item.has_whatsapp_photo === false && typeof item.invoice_number === 'string' && item.invoice_number.length > 0
    && typeof item.operation_date === 'string'
  ))) throw new Error('Lista salva inválida');
  return parsed;
};

export default function useReceiptPhotoPendencies() {
  const [initial] = useState(() => {
    let key: string | null = null;
    try { key = receiptPhotoStorageKey(); return { key, snapshot: readSnapshot(key), error: !key }; }
    catch { return { key, snapshot: emptySnapshot(), error: true }; }
  });
  const [snapshot, setSnapshot] = useState(initial.snapshot);
  const [storageError, setStorageError] = useState(initial.error);
  const current = useRef(snapshot);
  const revision = useRef(0);

  const commit = useCallback((next: Snapshot) => {
    revision.current++;
    current.current = next;
    setSnapshot(next);
    try {
      if (!initial.key) throw new Error('Usuário não identificado');
      localStorage.setItem(initial.key, JSON.stringify(next));
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [initial.key]);

  const rememberBag = useCallback((bag: ReceiptBag) => {
    commit({ ...current.current, items: reconcileBagPhotoPendencies(current.current.items, bag), saved_at: new Date().toISOString() });
  }, [commit]);
  const rememberAttempt = useCallback((item: MissingReceiptPhoto) => {
    if (item.has_whatsapp_photo || item.receipt_photo_required === false) return;
    if (current.current.items.some(existing => !existing.confirmation_uncertain && existing.bag_id === item.bag_id
      && existing.company_id === item.company_id && canonicalReceiptInvoice(existing.invoice_number) === canonicalReceiptInvoice(item.invoice_number))) return;
    commit({ ...current.current, items: uniquePhotoPendencies([...current.current.items,
      { ...item, confirmation_uncertain: true }]), saved_at: new Date().toISOString() });
  }, [commit]);
  const forgetAttempt = useCallback((bagId: number, invoice: string) => {
    commit({ ...current.current, items: current.current.items.filter(item => !(item.confirmation_uncertain
      && item.bag_id === bagId && item.invoice_number === invoice)), saved_at: new Date().toISOString() });
  }, [commit]);
  const acceptList = useCallback((data: ReceiptBagListResponse, expectedRevision: number) => {
    if (revision.current !== expectedRevision) return;
    const complete = Array.isArray(data.missing_photo_items);
    const currentBagIds = new Set(data.rows.map(row => row.bag_id));
    const items = complete ? [
      ...current.current.items.filter(item => !currentBagIds.has(item.bag_id)).map(item => ({ ...item, needs_refresh: true })),
      ...data.missing_photo_items!,
    ] : [...current.current.items,
      ...data.pending_items.filter(item => ['confirmed', 'recovered'].includes(item.status) && !item.has_whatsapp_photo)];
    commit({ version: 1, items: uniquePhotoPendencies(items), saved_at: new Date().toISOString(),
      synced_at: complete ? new Date().toISOString() : current.current.synced_at });
  }, [commit]);
  const getRevision = useCallback(() => revision.current, []);
  return { ...snapshot, storageError, rememberBag, rememberAttempt, forgetAttempt, acceptList, getRevision };
}
