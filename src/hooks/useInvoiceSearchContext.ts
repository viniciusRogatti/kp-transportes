import { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../data';
import { IDanfe, IInvoiceSearchContext } from '../types/types';
import { buildInvoiceContextKey } from '../utils/invoiceContextKey';

type LoadOptions = { force?: boolean; includeTripDriver?: boolean };
const BATCH_SIZE = 500;
const STALE_MS = 30000;

// Identity is company + invoice throughout, including caching, loading and errors.
// Legacy per-NF fallbacks mixed identically numbered invoices from different shippers.
export default function useInvoiceSearchContext() {
  const [invoiceContextByNf, setContexts] = useState<Record<string, IInvoiceSearchContext>>({});
  const [driverLoadingByInvoice, setLoading] = useState<Record<string, boolean>>({});
  const [driverErrorByInvoice, setErrors] = useState<Record<string, boolean>>({});
  const loadedAt = useRef<Record<string, number>>({});
  const requestByKey = useRef<Record<string, number>>({});
  const sequence = useRef(0);

  const loadInvoiceContext = useCallback(async (danfes: IDanfe[], options?: LoadOptions) => {
    const unique = new Map(danfes.map((danfe) => [buildInvoiceContextKey(danfe.company_id, danfe.invoice_number), danfe]));
    const pending = Array.from(unique.entries()).filter(([key]) => options?.force || (!requestByKey.current[key]
      && Date.now() - (loadedAt.current[key] || 0) >= STALE_MS));
    const request = ++sequence.current;
    pending.forEach(([key]) => { requestByKey.current[key] = request; });
    setLoading((old) => ({ ...old, ...Object.fromEntries(pending.map(([key]) => [key, true])) }));
    setErrors((old) => ({ ...old, ...Object.fromEntries(pending.map(([key]) => [key, false])) }));
    for (let index = 0; index < pending.length; index += BATCH_SIZE) {
      const batch = pending.slice(index, index + BATCH_SIZE);
      try {
        const { data } = await axios.post<Record<string, IInvoiceSearchContext>>(`${API_URL}/danfes/search-context`, {
          invoices: batch.map(([, danfe]) => ({ company_id: Number(danfe.company_id) || null, invoice_number: String(danfe.invoice_number).trim() })),
        });
        const accepted = batch.filter(([key]) => requestByKey.current[key] === request && data?.[key]);
        accepted.forEach(([key]) => { loadedAt.current[key] = Date.now(); });
        setContexts((old) => ({ ...old, ...Object.fromEntries(accepted.map(([key]) => [key, data[key]])) }));
        setErrors((old) => ({ ...old, ...Object.fromEntries(batch.filter(([key]) => requestByKey.current[key] === request)
          .map(([key]) => [key, !data?.[key]])) }));
      } catch {
        setErrors((old) => ({ ...old, ...Object.fromEntries(batch.filter(([key]) => requestByKey.current[key] === request).map(([key]) => [key, true])) }));
      } finally {
        const finished = batch.filter(([key]) => requestByKey.current[key] === request);
        finished.forEach(([key]) => { delete requestByKey.current[key]; });
        setLoading((old) => ({ ...old, ...Object.fromEntries(finished.map(([key]) => [key, false])) }));
      }
    }
  }, []);
  const refreshInvoiceContext = useCallback((danfes: IDanfe[], options?: Omit<LoadOptions, 'force'>) => (
    loadInvoiceContext(danfes, { ...options, force: true })
  ), [loadInvoiceContext]);
  const seedInvoiceContext = useCallback((contexts: Record<string, IInvoiceSearchContext>) => {
    const keys = Object.keys(contexts).filter((key) => key.includes('::'));
    keys.forEach((key) => { loadedAt.current[key] = Date.now(); delete requestByKey.current[key]; });
    setContexts((old) => ({ ...old, ...Object.fromEntries(keys.map((key) => [key, contexts[key]])) }));
    setLoading((old) => ({ ...old, ...Object.fromEntries(keys.map((key) => [key, false])) }));
    setErrors((old) => ({ ...old, ...Object.fromEntries(keys.map((key) => [key, false])) }));
  }, []);
  return { invoiceContextByNf, driverLoadingByInvoice, driverErrorByInvoice, loadInvoiceContext, refreshInvoiceContext, seedInvoiceContext };
}
