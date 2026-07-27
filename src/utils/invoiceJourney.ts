import { IInvoiceJourneyActor, IInvoiceJourneyEvent, InvoiceJourneyCategory } from '../types/types';

export const JOURNEY_CATEGORY_LABELS: Record<'all' | InvoiceJourneyCategory, string> = {
  all: 'Todos',
  import: 'Importação',
  routing: 'Rotas',
  delivery: 'Entrega',
  receipt: 'Canhotos',
  occurrence: 'Ocorrências',
  return: 'Devoluções',
  alert: 'Alertas',
  document: 'Documentos',
};

const ACTOR_SOURCE_LABELS: Record<string, string> = {
  user: 'Usuário',
  driver: 'Motorista',
  driver_app: 'Aplicativo do motorista',
  operation: 'Operação',
  operations_panel: 'Painel operacional',
  integration: 'Integração',
  system: 'Sistema',
};

export function filterJourneyEvents(
  events: IInvoiceJourneyEvent[],
  category: 'all' | InvoiceJourneyCategory,
) {
  return category === 'all' ? events : events.filter((event) => event.category === category);
}

export function getJourneyActorLabel(actor?: IInvoiceJourneyActor | null) {
  if (actor?.name) return actor.name;
  return ACTOR_SOURCE_LABELS[actor?.source || 'system'] || 'Não registrado';
}

export function formatJourneyDuration(hours: number | null) {
  if (hours === null || !Number.isFinite(hours)) return 'Em andamento';
  if (hours < 24) return `${hours.toLocaleString('pt-BR')} h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round((hours % 24) * 10) / 10;
  return remainingHours ? `${days} d ${remainingHours.toLocaleString('pt-BR')} h` : `${days} d`;
}
