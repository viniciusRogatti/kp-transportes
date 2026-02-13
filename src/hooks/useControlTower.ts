import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addReturnObservation,
  confirmReturnSubmission,
  getActionQueue,
  getControlTowerCharts,
  getControlTowerSummary,
  getReturnById,
  getReturnsTable,
  requestPickup,
  setPickupPriority,
  updatePickupStatus,
} from '../services/controlTowerService';
import { BacklogStatus, ControlTowerFilters, PaginationInput, SortingInput } from '../types/controlTower';

export function useControlTowerData(filters: ControlTowerFilters, pagination: PaginationInput, sorting?: SortingInput) {
  const keyFilters = useMemo(() => ({ ...filters }), [filters]);

  const summary = useQuery({
    queryKey: ['ct-summary', keyFilters],
    queryFn: () => getControlTowerSummary(filters),
  });

  const charts = useQuery({
    queryKey: ['ct-charts', keyFilters],
    queryFn: () => getControlTowerCharts(filters),
  });

  const queue = useQuery({
    queryKey: ['ct-queue', keyFilters],
    queryFn: () => getActionQueue(filters),
  });

  const table = useQuery({
    queryKey: ['ct-returns-table', keyFilters, pagination, sorting],
    queryFn: () => getReturnsTable(filters, pagination, sorting),
    placeholderData: (previousData) => previousData,
  });

  return { summary, charts, queue, table };
}

export function useControlTowerMutations(filters: ControlTowerFilters, pagination: PaginationInput, sorting?: SortingInput) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({
    predicate: (query) => String(query.queryKey?.[0] || '').startsWith('ct-'),
  });

  const requestPickupMutation = useMutation({
    mutationFn: ({ returnId, scheduledFor, notes }: { returnId: string; scheduledFor?: string; notes?: string }) => requestPickup(returnId, scheduledFor, notes),
    onSuccess: invalidate,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ pickupId, status }: { pickupId: string; status: BacklogStatus }) => updatePickupStatus(pickupId, status),
    onSuccess: invalidate,
  });

  const confirmSubmissionMutation = useMutation({
    mutationFn: (batchId: string) => confirmReturnSubmission(batchId),
    onSuccess: invalidate,
  });

  const addObservationMutation = useMutation({
    mutationFn: ({ returnId, note }: { returnId: string; note: string }) => addReturnObservation(returnId, note),
    onSuccess: invalidate,
  });

  const prioritizePickupMutation = useMutation({
    mutationFn: ({ returnId, pickupPriority }: { returnId: string; pickupPriority: boolean }) => setPickupPriority(returnId, pickupPriority),
    onSuccess: invalidate,
  });

  const selectedCacheKey = ['ct-returns-table', filters, pagination, sorting] as const;

  const getSelectedFromCache = (id: string) => {
    const table = queryClient.getQueryData<{ rows: Array<{ id: string }> }>(selectedCacheKey);
    if (table?.rows.some((row) => row.id === id)) {
      return getReturnById(id);
    }

    return getReturnById(id);
  };

  return {
    requestPickupMutation,
    updateStatusMutation,
    confirmSubmissionMutation,
    addObservationMutation,
    prioritizePickupMutation,
    getSelectedFromCache,
  };
}
