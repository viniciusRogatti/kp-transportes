import { cn } from '../lib/cn';

export type SemanticTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'redelivery';
export type SemanticToneVariant = 'solid' | 'panel' | 'border';

type DanfeLegendItem = {
  key: 'delivered' | 'retained' | 'returned' | 'on_the_way' | 'pending' | 'redelivery' | 'cancelled';
  label: string;
  description: string;
  tone: SemanticTone;
  borderClassName: string;
  filterStatuses: readonly string[];
};

const SEMANTIC_TONE_CLASSNAMES: Record<SemanticTone, Record<SemanticToneVariant, string>> = {
  neutral: {
    solid: 'semantic-solid-neutral',
    panel: 'semantic-panel-neutral',
    border: 'semantic-border-neutral',
  },
  info: {
    solid: 'semantic-solid-info',
    panel: 'semantic-panel-info',
    border: 'semantic-border-info',
  },
  success: {
    solid: 'semantic-solid-success',
    panel: 'semantic-panel-success',
    border: 'semantic-border-success',
  },
  warning: {
    solid: 'semantic-solid-warning',
    panel: 'semantic-panel-warning',
    border: 'semantic-border-warning',
  },
  danger: {
    solid: 'semantic-solid-danger',
    panel: 'semantic-panel-danger',
    border: 'semantic-border-danger',
  },
  redelivery: {
    solid: 'semantic-solid-redelivery',
    panel: 'semantic-panel-redelivery',
    border: 'semantic-border-redelivery',
  },
};

const OPERATIONAL_STATUS_TONES: Record<string, SemanticTone> = {
  pending: 'warning',
  assigned: 'info',
  on_the_way: 'info',
  arrived: 'info',
  delivered: 'success',
  completed: 'success',
  retained: 'warning',
  returned: 'danger',
  redelivery: 'redelivery',
  cancelled: 'neutral',
};

const OPERATIONAL_STATUS_BORDER_CLASSNAMES: Record<string, string> = {
  pending: 'status-border-pending',
  assigned: 'status-border-assigned',
  on_the_way: 'status-border-on-the-way',
  arrived: 'status-border-arrived',
  delivered: 'status-border-delivered',
  completed: 'status-border-completed',
  retained: 'status-border-retained',
  returned: 'status-border-returned',
  redelivery: 'status-border-redelivery',
  cancelled: 'status-border-cancelled',
};

export const OPERATIONAL_STATUS_LABELS: Record<string, string> = {
  pending: 'PENDENTE',
  assigned: 'ATRIBUIDA',
  on_the_way: 'EM ROTA',
  arrived: 'NO LOCAL',
  delivered: 'ENTREGUE',
  completed: 'ENTREGUE',
  retained: 'CANHOTO RETIDO',
  returned: 'DEVOLVIDA',
  redelivery: 'REENTREGA',
  cancelled: 'CANCELADA',
};

export const DANFE_STATUS_LEGEND: readonly DanfeLegendItem[] = [
  {
    key: 'delivered',
    label: 'Entregue',
    description: 'Borda verde',
    tone: 'success',
    borderClassName: OPERATIONAL_STATUS_BORDER_CLASSNAMES.delivered,
    filterStatuses: ['delivered', 'completed'],
  },
  {
    key: 'retained',
    label: 'Canhoto retido',
    description: 'Borda laranja',
    tone: 'warning',
    borderClassName: OPERATIONAL_STATUS_BORDER_CLASSNAMES.retained,
    filterStatuses: ['retained'],
  },
  {
    key: 'returned',
    label: 'Devolucao',
    description: 'Borda vermelha',
    tone: 'danger',
    borderClassName: OPERATIONAL_STATUS_BORDER_CLASSNAMES.returned,
    filterStatuses: ['returned'],
  },
  {
    key: 'on_the_way',
    label: 'Em rota',
    description: 'Borda azul',
    tone: 'info',
    borderClassName: OPERATIONAL_STATUS_BORDER_CLASSNAMES.on_the_way,
    filterStatuses: ['assigned', 'on_the_way', 'arrived'],
  },
  {
    key: 'pending',
    label: 'Pendente',
    description: 'Borda ambar',
    tone: 'warning',
    borderClassName: OPERATIONAL_STATUS_BORDER_CLASSNAMES.pending,
    filterStatuses: ['pending'],
  },
  {
    key: 'redelivery',
    label: 'Reentrega',
    description: 'Borda roxa',
    tone: 'redelivery',
    borderClassName: OPERATIONAL_STATUS_BORDER_CLASSNAMES.redelivery,
    filterStatuses: ['redelivery'],
  },
  {
    key: 'cancelled',
    label: 'Cancelada',
    description: 'Borda cinza',
    tone: 'neutral',
    borderClassName: OPERATIONAL_STATUS_BORDER_CLASSNAMES.cancelled,
    filterStatuses: ['cancelled'],
  },
] as const;

export type DanfeLegendKey = (typeof DANFE_STATUS_LEGEND)[number]['key'];

export const normalizeOperationalStatus = (value: unknown) => String(value || '').trim().toLowerCase();

export const getSemanticToneClassName = (
  tone: SemanticTone,
  variant: SemanticToneVariant = 'solid',
) => SEMANTIC_TONE_CLASSNAMES[tone][variant];

export const getOperationalStatusTone = (value: unknown): SemanticTone => {
  const normalized = normalizeOperationalStatus(value);
  return OPERATIONAL_STATUS_TONES[normalized] || 'neutral';
};

export const getOperationalStatusLabel = (value: unknown, emptyLabel = 'SEM STATUS') => {
  const normalized = normalizeOperationalStatus(value);
  if (!normalized) return emptyLabel;
  return OPERATIONAL_STATUS_LABELS[normalized] || normalized.replace(/_/g, ' ').toUpperCase();
};

export const getOperationalStatusBorderClassName = (value: unknown) => {
  const normalized = normalizeOperationalStatus(value);
  return OPERATIONAL_STATUS_BORDER_CLASSNAMES[normalized] || OPERATIONAL_STATUS_BORDER_CLASSNAMES.cancelled;
};

export const getOperationalStatusBadgeClassName = (value: unknown) => (
  getSemanticToneClassName(getOperationalStatusTone(value))
);

export const getOperationalStatusCardClassName = (value: unknown) => cn(
  'border-2',
  getOperationalStatusBorderClassName(value),
);

export const getDanfeLegendItem = (key: DanfeLegendKey) => (
  DANFE_STATUS_LEGEND.find((item) => item.key === key) || null
);

export const matchesDanfeLegendFilter = (status: unknown, filterKey: DanfeLegendKey) => {
  const legendItem = getDanfeLegendItem(filterKey);
  if (!legendItem) return false;
  return legendItem.filterStatuses.includes(normalizeOperationalStatus(status));
};

export const getOccurrenceTone = (value: unknown): SemanticTone => (
  normalizeOperationalStatus(value) === 'resolved' ? 'success' : 'warning'
);

export const getAlertSeverityTone = (value: unknown): SemanticTone => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'CRITICAL') return 'danger';
  if (normalized === 'INFO') return 'info';
  return 'warning';
};
