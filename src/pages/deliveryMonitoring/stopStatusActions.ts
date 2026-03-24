import { SemanticTone, normalizeOperationalStatus } from '../../utils/statusStyles';

export type ManualStopStatus = 'returned' | 'redelivery' | 'retained' | 'cancelled';

export type ManualStopStatusAction = {
  status: ManualStopStatus;
  label: string;
  confirmLabel: string;
  tone: SemanticTone;
};

const MANUAL_STOP_STATUS_TRANSITIONS: Record<string, readonly ManualStopStatus[]> = {
  pending: ['returned', 'redelivery', 'retained', 'cancelled'],
  assigned: ['returned', 'redelivery', 'retained', 'cancelled'],
  on_the_way: ['returned', 'redelivery', 'retained', 'cancelled'],
  arrived: ['returned', 'redelivery', 'retained', 'cancelled'],
  delivered: ['retained'],
  completed: ['retained'],
};

export const MANUAL_STOP_STATUS_ACTIONS: readonly ManualStopStatusAction[] = [
  {
    status: 'returned',
    label: 'Marcar devolucao',
    confirmLabel: 'devolucao',
    tone: 'danger',
  },
  {
    status: 'redelivery',
    label: 'Marcar reentrega',
    confirmLabel: 'reentrega',
    tone: 'redelivery',
  },
  {
    status: 'retained',
    label: 'Marcar canhoto retido',
    confirmLabel: 'canhoto retido',
    tone: 'warning',
  },
  {
    status: 'cancelled',
    label: 'Marcar cancelada',
    confirmLabel: 'cancelamento',
    tone: 'neutral',
  },
] as const;

export const getManualStopStatusLabel = (status: ManualStopStatus) => (
  MANUAL_STOP_STATUS_ACTIONS.find((action) => action.status === status)?.confirmLabel || status
);

export const canManuallyUpdateStopStatus = (currentStatus: unknown, nextStatus: ManualStopStatus) => {
  const normalizedCurrentStatus = normalizeOperationalStatus(currentStatus) || 'pending';
  return Boolean(MANUAL_STOP_STATUS_TRANSITIONS[normalizedCurrentStatus]?.includes(nextStatus));
};
