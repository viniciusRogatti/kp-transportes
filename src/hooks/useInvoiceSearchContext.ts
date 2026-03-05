import { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../data';
import { IDanfe, IOccurrence, IReturnBatch, IInvoiceSearchContext } from '../types/types';

const VALID_RETURN_TYPES = new Set(['total', 'partial', 'sobra', 'coleta']);
const REQUEST_BATCH_SIZE = 8;

function normalizeInvoiceNumber(value: unknown) {
  return String(value || '').trim();
}

function buildInvoiceContext(
  invoiceNumber: string,
  occurrences: IOccurrence[],
  returnBatches: IReturnBatch[],
): IInvoiceSearchContext {
  const creditLetterOccurrences = occurrences.filter((occurrence) => (
    String(occurrence.resolution_type || '').trim().toLowerCase() === 'talao_mercadoria_faltante'
  ));
  const creditLetterCompletedCount = creditLetterOccurrences.filter((occurrence) => (
    String(occurrence.credit_status || '').trim().toLowerCase() === 'completed'
  )).length;
  const creditLetterPendingCount = Math.max(0, creditLetterOccurrences.length - creditLetterCompletedCount);

  const returnTypes = Array.from(new Set(
    returnBatches.flatMap((batch) => (
      (batch.notes || [])
        .filter((note) => normalizeInvoiceNumber(note.invoice_number) === invoiceNumber)
        .map((note) => note.return_type)
    )),
  ))
    .filter((returnType): returnType is 'total' | 'partial' | 'sobra' | 'coleta' => (
      VALID_RETURN_TYPES.has(String(returnType))
    ));

  return {
    occurrence_count: occurrences.length,
    occurrence_pending_count: occurrences.filter((occurrence) => occurrence.status === 'pending').length,
    occurrence_resolved_count: occurrences.filter((occurrence) => occurrence.status === 'resolved').length,
    credit_letter_count: creditLetterOccurrences.length,
    credit_letter_pending_count: creditLetterPendingCount,
    credit_letter_completed_count: creditLetterCompletedCount,
    return_count: returnTypes.length,
    return_types: returnTypes,
  };
}

async function fetchInvoiceContext(invoiceNumber: string): Promise<IInvoiceSearchContext> {
  try {
    const [occurrencesResponse, returnBatchesResponse] = await Promise.all([
      axios.get<IOccurrence[]>(`${API_URL}/occurrences/search`, {
        params: { invoice_number: invoiceNumber },
      }),
      axios.get<IReturnBatch[]>(`${API_URL}/returns/batches/search`, {
        params: {
          invoice_number: invoiceNumber,
          workflow_status: 'all',
        },
      }),
    ]);

    const occurrences = Array.isArray(occurrencesResponse.data) ? occurrencesResponse.data : [];
    const returnBatches = Array.isArray(returnBatchesResponse.data) ? returnBatchesResponse.data : [];
    return buildInvoiceContext(invoiceNumber, occurrences, returnBatches);
  } catch (error) {
    console.error(`Erro ao carregar contexto da NF ${invoiceNumber}`, error);
    return buildInvoiceContext(invoiceNumber, [], []);
  }
}

export default function useInvoiceSearchContext() {
  const [invoiceContextByNf, setInvoiceContextByNf] = useState<Record<string, IInvoiceSearchContext>>({});
  const invoiceContextRef = useRef<Record<string, IInvoiceSearchContext>>({});

  const loadInvoiceContext = useCallback(async (danfesToProcess: IDanfe[]) => {
    const uniqueInvoiceNumbers = Array.from(new Set(
      danfesToProcess
        .map((danfe) => normalizeInvoiceNumber(danfe.invoice_number))
        .filter(Boolean),
    ));
    const missingInvoiceNumbers = uniqueInvoiceNumbers.filter((invoiceNumber) => !invoiceContextRef.current[invoiceNumber]);

    if (!missingInvoiceNumbers.length) return;

    const contextEntries: Array<[string, IInvoiceSearchContext]> = [];
    for (let index = 0; index < missingInvoiceNumbers.length; index += REQUEST_BATCH_SIZE) {
      const chunk = missingInvoiceNumbers.slice(index, index + REQUEST_BATCH_SIZE);
      const chunkEntries = await Promise.all(
        chunk.map(async (invoiceNumber): Promise<[string, IInvoiceSearchContext]> => (
          [invoiceNumber, await fetchInvoiceContext(invoiceNumber)]
        )),
      );
      contextEntries.push(...chunkEntries);
    }

    if (!contextEntries.length) return;

    setInvoiceContextByNf((previous) => {
      const next = { ...previous };
      contextEntries.forEach(([invoiceNumber, context]) => {
        if (!next[invoiceNumber]) {
          next[invoiceNumber] = context;
        }
      });
      invoiceContextRef.current = next;
      return next;
    });
  }, []);

  return {
    invoiceContextByNf,
    loadInvoiceContext,
  };
}
