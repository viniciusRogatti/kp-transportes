export type DeliveryStage = 'unassigned' | 'assigned' | 'on_the_way' | 'on_site' | 'pending_receipt' | 'completed';

export const STAGE_LABELS: Record<DeliveryStage, string> = {
  unassigned: 'Sem motorista',
  assigned: 'Atribuida',
  on_the_way: 'A caminho',
  on_site: 'No local',
  pending_receipt: 'Entregue, foto pendente',
  completed: 'Finalizada',
};

export const STAGE_ORDER: DeliveryStage[] = ['unassigned', 'assigned', 'on_the_way', 'on_site', 'pending_receipt', 'completed'];

export const STAGE_PRIORITY: Record<DeliveryStage, number> = {
  on_site: 0,
  on_the_way: 1,
  pending_receipt: 2,
  assigned: 3,
  unassigned: 4,
  completed: 5,
};

export const STAGE_STYLE: Record<DeliveryStage, {
  fill: string;
  border: string;
  opacity: number;
}> = {
  unassigned: {
    fill: '#e2e8f0',
    border: '#eed4a4',
    opacity: 0.95,
  },
  assigned: {
    fill: '#dbeafe',
    border: '#2563eb',
    opacity: 0.97,
  },
  on_the_way: {
    fill: '#fef3c7',
    border: '#ca8a04',
    opacity: 0.98,
  },
  on_site: {
    fill: '#ffedd5',
    border: '#f97316',
    opacity: 0.98,
  },
  pending_receipt: {
    fill: '#bbf7d0',
    border: '#22c55e',
    opacity: 0.48,
  },
  completed: {
    fill: '#dcfce7',
    border: '#16a34a',
    opacity: 0.58,
  },
};

export const CLUSTER_FALLBACK_MAX_ZOOM = 8;
export const CLUSTER_FALLBACK_MIN_DELIVERIES = 130;

export const DRIVER_ASSIGNMENT_BORDER = {
  noDriver: '#334155',
};
