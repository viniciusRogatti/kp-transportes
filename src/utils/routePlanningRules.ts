import { IDanfe, ITrip, ITripNote } from '../types/types';
import { normalizeOperationalStatus } from './statusStyles';

export const ROUTE_FINAL_STATUSES = new Set([
  'returned',
  'cancelled',
  'delivered',
  'completed',
  'redelivery',
  'retained',
]);

const ROUTING_POOL_ALLOWED_STATUSES = new Set(['', 'pending', 'redelivery', 'assigned']);
const DIRECT_ROUTING_ALLOWED_STATUSES = new Set(['', 'pending', 'redelivery']);

export type RouteAssignmentInfo = {
  tripId: number;
  tripDate?: string | null;
  tripCreatedAt?: string | null;
  driverId?: number | null;
  driverName?: string | null;
  noteId?: number | null;
  noteStatus?: string | null;
  sequence?: number | null;
  runNumber?: number | null;
};

export type RouteReturnInfo = {
  batchCode?: string | null;
  returnType?: string | null;
  returnDate?: string | null;
  workflowStatus?: string | null;
} | null;

export type RoutePlanningDecision =
  | {
    outcome: 'allow';
    reason: 'pending' | 'redelivery' | 'stale_assignment' | 'returned_cleared';
    title: string;
    message: string;
  }
  | {
    outcome: 'assignment_conflict';
    reason: 'assigned_to_other_route';
    title: string;
    message: string;
    assignment: RouteAssignmentInfo;
  }
  | {
    outcome: 'blocked';
    reason: 'returned_active' | 'retained' | 'cancelled' | 'cancelled_replaced' | 'delivered' | 'unknown_status';
    title: string;
    message: string;
    replacementInvoiceNumber?: string | null;
    returnInfo?: RouteReturnInfo;
  };

const normalizeInvoiceNumber = (value: unknown) => String(value || '').trim();

export const normalizeRoutePlanningStatus = (value: unknown) => normalizeOperationalStatus(value);

export const isRouteFinalStatus = (value: unknown) => ROUTE_FINAL_STATUSES.has(normalizeRoutePlanningStatus(value));

export const isRoutePlanningTripActive = (trip: Pick<ITrip, 'TripNotes'> | null | undefined) => {
  const tripNotes = trip?.TripNotes;
  const notes = Array.isArray(tripNotes) ? tripNotes : [];
  return notes.some((note) => !isRouteFinalStatus(note.status));
};

export const canDanfeAppearInRoutingPool = (status: unknown) => ROUTING_POOL_ALLOWED_STATUSES.has(
  normalizeRoutePlanningStatus(status),
);

export const canDanfeBeRoutedDirectly = (status: unknown) => DIRECT_ROUTING_ALLOWED_STATUSES.has(
  normalizeRoutePlanningStatus(status),
);

export const getRoutePlanningStatusLabel = (status: unknown) => {
  const normalized = normalizeRoutePlanningStatus(status);
  if (!normalized || normalized === 'pending') return 'pendente';
  if (normalized === 'assigned') return 'atribuida';
  if (normalized === 'redelivery') return 'reentrega';
  if (normalized === 'returned') return 'devolucao';
  if (normalized === 'retained') return 'canhoto retido';
  if (normalized === 'cancelled') return 'cancelada';
  if (normalized === 'delivered' || normalized === 'completed') return 'entregue';
  if (normalized === 'on_the_way') return 'em rota';
  if (normalized === 'arrived') return 'no local';
  return normalized || 'sem status';
};

export const findActiveAssignmentForInvoice = (
  trips: ITrip[] = [],
  invoiceNumber: string,
): RouteAssignmentInfo | null => {
  const normalizedInvoiceNumber = normalizeInvoiceNumber(invoiceNumber);
  if (!normalizedInvoiceNumber) return null;

  const matchingTrip = trips.find((trip) => isRoutePlanningTripActive(trip)
    && (trip.TripNotes || []).some((note) => (
      normalizeInvoiceNumber(note.invoice_number) === normalizedInvoiceNumber
      && !isRouteFinalStatus(note.status)
    )));

  if (!matchingTrip) return null;

  const matchingNote = (matchingTrip.TripNotes || []).find((note) => (
    normalizeInvoiceNumber(note.invoice_number) === normalizedInvoiceNumber
    && !isRouteFinalStatus(note.status)
  ));

  if (!matchingNote) return null;

  return {
    tripId: Number(matchingTrip.id),
    tripDate: matchingTrip.date || null,
    tripCreatedAt: matchingTrip.created_at || null,
    driverId: matchingTrip.Driver?.id ? Number(matchingTrip.Driver.id) : (matchingTrip.driver_id ? Number(matchingTrip.driver_id) : null),
    driverName: matchingTrip.Driver?.name || null,
    noteId: matchingNote.id ? Number(matchingNote.id) : null,
    noteStatus: normalizeRoutePlanningStatus(matchingNote.status),
    sequence: matchingNote.order ? Number(matchingNote.order) : null,
    runNumber: matchingTrip.run_number ? Number(matchingTrip.run_number) : null,
  };
};

export const evaluateRoutePlanningDecision = ({
  danfe,
  assignment = null,
  activeReturn = null,
}: {
  danfe: Pick<IDanfe, 'invoice_number' | 'status' | 'replacement_invoice_number'>;
  assignment?: RouteAssignmentInfo | null;
  activeReturn?: RouteReturnInfo;
}): RoutePlanningDecision => {
  const invoiceNumber = normalizeInvoiceNumber(danfe.invoice_number);
  const status = normalizeRoutePlanningStatus(danfe.status);

  if (canDanfeBeRoutedDirectly(status)) {
    return {
      outcome: 'allow',
      reason: status === 'redelivery' ? 'redelivery' : 'pending',
      title: `NF ${invoiceNumber} liberada para roteirizacao`,
      message: status === 'redelivery'
        ? `A NF ${invoiceNumber} esta em reentrega e pode voltar para uma nova rota.`
        : `A NF ${invoiceNumber} esta pendente e pode ser adicionada na rota.`,
    };
  }

  if (status === 'assigned') {
    if (assignment) {
      return {
        outcome: 'assignment_conflict',
        reason: 'assigned_to_other_route',
        title: `NF ${invoiceNumber} ja esta atribuida`,
        message: `A NF ${invoiceNumber} ja foi atribuida a outra rota e precisa ser removida antes da reatribuicao.`,
        assignment,
      };
    }

    return {
      outcome: 'allow',
      reason: 'stale_assignment',
      title: `NF ${invoiceNumber} liberada por atribuicao sem rota ativa`,
      message: `A NF ${invoiceNumber} estava com status de atribuida, mas nao foi encontrada em nenhuma rota ativa e pode ser roteirizada novamente.`,
    };
  }

  if (status === 'returned') {
    if (activeReturn) {
      return {
        outcome: 'blocked',
        reason: 'returned_active',
        title: `NF ${invoiceNumber} em devolucao ativa`,
        message: `A NF ${invoiceNumber} esta vinculada a uma devolucao ativa e nao pode seguir para rota enquanto essa tratativa nao for encerrada.`,
        returnInfo: activeReturn,
      };
    }

    return {
      outcome: 'allow',
      reason: 'returned_cleared',
      title: `NF ${invoiceNumber} liberada apos cancelamento da devolucao`,
      message: `A NF ${invoiceNumber} voltou do status de devolucao sem lote ativo e pode ser roteirizada novamente.`,
    };
  }

  if (status === 'retained') {
    return {
      outcome: 'blocked',
      reason: 'retained',
      title: `NF ${invoiceNumber} com canhoto retido`,
      message: `A NF ${invoiceNumber} esta marcada como canhoto retido. Ela deve reaparecer como contexto da proxima entrega do mesmo cliente, e nao como nova entrega comum.`,
    };
  }

  if (status === 'cancelled') {
    const replacementInvoiceNumber = normalizeInvoiceNumber(danfe.replacement_invoice_number);
    return {
      outcome: 'blocked',
      reason: replacementInvoiceNumber ? 'cancelled_replaced' : 'cancelled',
      title: replacementInvoiceNumber
        ? `NF ${invoiceNumber} cancelada e refaturada`
        : `NF ${invoiceNumber} cancelada`,
      message: replacementInvoiceNumber
        ? `A NF ${invoiceNumber} foi cancelada e substituida pela NF ${replacementInvoiceNumber}. Use a NF nova para a roteirizacao.`
        : `A NF ${invoiceNumber} esta cancelada e nao pode ser adicionada em rota.`,
      replacementInvoiceNumber: replacementInvoiceNumber || null,
    };
  }

  if (status === 'delivered' || status === 'completed') {
    return {
      outcome: 'blocked',
      reason: 'delivered',
      title: `NF ${invoiceNumber} ja entregue`,
      message: `A NF ${invoiceNumber} ja esta com status final de entrega e nao pode voltar para uma nova rota por esta tela.`,
    };
  }

  return {
    outcome: 'blocked',
    reason: 'unknown_status',
    title: `NF ${invoiceNumber} com status nao roteirizavel`,
    message: `A NF ${invoiceNumber} esta com status ${getRoutePlanningStatusLabel(status)} e precisa de tratativa especifica antes de entrar em rota.`,
  };
};

export const groupRetainedRowsByCustomerId = <TRow extends { customer_id?: string | null }>(rows: TRow[] = []) => (
  rows.reduce<Map<string, TRow[]>>((accumulator, row) => {
    const customerId = normalizeInvoiceNumber(row.customer_id);
    if (!customerId) return accumulator;

    const savedRows = accumulator.get(customerId) || [];
    savedRows.push(row);
    accumulator.set(customerId, savedRows);
    return accumulator;
  }, new Map())
);

export const getRetainedContextsForNote = <TRow extends { customer_id?: string | null }>(
  note: Pick<ITripNote, 'customer_id'> | null | undefined,
  retainedByCustomerId: Map<string, TRow[]>,
) => {
  const customerId = normalizeInvoiceNumber(note?.customer_id);
  if (!customerId) return [] as TRow[];
  return retainedByCustomerId.get(customerId) || [];
};
