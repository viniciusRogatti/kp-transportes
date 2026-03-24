import { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../data';
import { IDanfe, IOccurrence, IReturnBatch, IInvoiceSearchContext, ITrip } from '../types/types';

const VALID_RETURN_TYPES = new Set(['total', 'partial', 'sobra', 'coleta']);
const REQUEST_BATCH_SIZE = 8;
const INACTIVE_TRIP_NOTE_STATUSES = new Set(['cancelled']);

type LoadInvoiceContextOptions = {
  force?: boolean;
  includeTripDriver?: boolean;
};

function normalizeInvoiceNumber(value: unknown) {
  return String(value || '').trim();
}

function getOccurrenceTimestamp(occurrence: IOccurrence) {
  const candidate = occurrence.resolved_at || occurrence.created_at;
  const parsed = new Date(candidate || '').getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickLatestOccurrence(occurrences: IOccurrence[]) {
  if (!occurrences.length) return null;

  return occurrences
    .slice()
    .sort((left, right) => getOccurrenceTimestamp(right) - getOccurrenceTimestamp(left))[0] || null;
}

function pickLatestTrip(trips: ITrip[], invoiceNumber: string) {
  const normalizedInvoiceNumber = normalizeInvoiceNumber(invoiceNumber);
  if (!normalizedInvoiceNumber) return null;

  const matchingTrip = trips.find((trip) => (
    (trip.TripNotes || []).some((note) => {
      const noteInvoice = normalizeInvoiceNumber(note.invoice_number);
      const noteStatus = String(note.status || '').trim().toLowerCase();
      return noteInvoice === normalizedInvoiceNumber && !INACTIVE_TRIP_NOTE_STATUSES.has(noteStatus);
    })
  ));

  return matchingTrip || trips[0] || null;
}

function buildInvoiceContext(
  invoiceNumber: string,
  occurrences: IOccurrence[],
  returnBatches: IReturnBatch[],
  trips: ITrip[],
  options?: { includeTripDriver?: boolean },
): IInvoiceSearchContext {
  const includeTripDriver = Boolean(options?.includeTripDriver);
  const latestOccurrence = pickLatestOccurrence(occurrences);
  const latestTrip = includeTripDriver ? pickLatestTrip(trips, invoiceNumber) : null;
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
    driver_name: includeTripDriver ? latestTrip?.Driver?.name || null : undefined,
    trip_id: includeTripDriver ? (latestTrip?.id ? Number(latestTrip.id) : null) : undefined,
    trip_date: includeTripDriver ? latestTrip?.date || null : undefined,
    trip_run_number: includeTripDriver ? (latestTrip?.run_number ? Number(latestTrip.run_number) : null) : undefined,
    latest_occurrence: latestOccurrence ? {
      id: Number(latestOccurrence.id),
      description: String(latestOccurrence.description || '').trim(),
      status: latestOccurrence.status,
      created_at: latestOccurrence.created_at,
      resolved_at: latestOccurrence.resolved_at,
    } : null,
  };
}

async function fetchInvoiceContext(invoiceNumber: string, options?: { includeTripDriver?: boolean }): Promise<IInvoiceSearchContext> {
  const includeTripDriver = Boolean(options?.includeTripDriver);

  try {
    const tripsPromise = includeTripDriver
      ? axios.get<ITrip[]>(`${API_URL}/trips/search/note/${encodeURIComponent(invoiceNumber)}`)
      : Promise.resolve({ data: [] as ITrip[] });

    const [occurrencesResponse, returnBatchesResponse, tripsResponse] = await Promise.all([
      axios.get<IOccurrence[]>(`${API_URL}/occurrences/search`, {
        params: { invoice_number: invoiceNumber },
      }),
      axios.get<IReturnBatch[]>(`${API_URL}/returns/batches/search`, {
        params: {
          invoice_number: invoiceNumber,
          workflow_status: 'all',
        },
      }),
      tripsPromise,
    ]);

    const occurrences = Array.isArray(occurrencesResponse.data) ? occurrencesResponse.data : [];
    const returnBatches = Array.isArray(returnBatchesResponse.data) ? returnBatchesResponse.data : [];
    const trips = Array.isArray(tripsResponse.data) ? tripsResponse.data : [];
    return buildInvoiceContext(invoiceNumber, occurrences, returnBatches, trips, { includeTripDriver });
  } catch (error) {
    console.error(`Erro ao carregar contexto da NF ${invoiceNumber}`, error);
    return buildInvoiceContext(invoiceNumber, [], [], [], { includeTripDriver });
  }
}

export default function useInvoiceSearchContext() {
  const [invoiceContextByNf, setInvoiceContextByNf] = useState<Record<string, IInvoiceSearchContext>>({});
  const invoiceContextRef = useRef<Record<string, IInvoiceSearchContext>>({});

  const loadInvoiceContext = useCallback(async (danfesToProcess: IDanfe[], options?: LoadInvoiceContextOptions) => {
    const includeTripDriver = Boolean(options?.includeTripDriver);
    const uniqueInvoiceNumbers = Array.from(new Set(
      danfesToProcess
        .map((danfe) => normalizeInvoiceNumber(danfe.invoice_number))
        .filter(Boolean),
    ));
    const shouldForceReload = Boolean(options?.force);
    const missingInvoiceNumbers = uniqueInvoiceNumbers.filter((invoiceNumber) => {
      if (shouldForceReload) return true;

      const existingContext = invoiceContextRef.current[invoiceNumber];
      if (!existingContext) return true;
      if (includeTripDriver && existingContext.driver_name === undefined) return true;
      return false;
    });

    if (!missingInvoiceNumbers.length) return;

    const contextEntries: Array<[string, IInvoiceSearchContext]> = [];
    for (let index = 0; index < missingInvoiceNumbers.length; index += REQUEST_BATCH_SIZE) {
      const chunk = missingInvoiceNumbers.slice(index, index + REQUEST_BATCH_SIZE);
      const chunkEntries = await Promise.all(
        chunk.map(async (invoiceNumber): Promise<[string, IInvoiceSearchContext]> => (
          [invoiceNumber, await fetchInvoiceContext(invoiceNumber, { includeTripDriver })]
        )),
      );
      contextEntries.push(...chunkEntries);
    }

    if (!contextEntries.length) return;

    setInvoiceContextByNf((previous) => {
      const next = { ...previous };
      contextEntries.forEach(([invoiceNumber, context]) => {
        next[invoiceNumber] = context;
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
