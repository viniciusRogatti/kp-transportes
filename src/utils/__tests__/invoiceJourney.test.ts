import {
  filterJourneyEvents,
  formatJourneyDuration,
  getJourneyActorLabel,
} from '../invoiceJourney';
import { IInvoiceJourneyEvent } from '../../types/types';

const events: IInvoiceJourneyEvent[] = [
  {
    id: 'route-1',
    type: 'ROUTE_ASSIGNED',
    category: 'routing',
    occurredAt: '2026-07-20T09:00:00.000Z',
    title: 'Incluída na rota',
    description: null,
    actor: { id: null, name: null, source: 'operation' },
    tone: 'info',
    metadata: { tripId: 10 },
    sourceRecord: 'trip_note',
  },
  {
    id: 'receipt-1',
    type: 'RECEIPT_POSTED',
    category: 'receipt',
    occurredAt: '2026-07-20T18:00:00.000Z',
    title: 'Canhoto recebido',
    description: null,
    actor: { id: 4, name: 'João', source: 'driver' },
    tone: 'success',
    metadata: {},
    sourceRecord: 'receipt',
  },
];

describe('invoiceJourney', () => {
  it('filtra eventos sem alterar a lista original', () => {
    expect(filterJourneyEvents(events, 'routing')).toEqual([events[0]]);
    expect(filterJourneyEvents(events, 'all')).toEqual(events);
    expect(events).toHaveLength(2);
  });

  it('exibe autoria conhecida e fallback para registros legados', () => {
    expect(getJourneyActorLabel(events[1].actor)).toBe('João');
    expect(getJourneyActorLabel({ id: null, name: null, source: 'operation' })).toBe('Operação');
    expect(getJourneyActorLabel({ id: null, name: null, source: 'legacy' })).toBe('Não registrado');
  });

  it('formata duração em horas, dias e andamento', () => {
    expect(formatJourneyDuration(2.5)).toBe('2,5 h');
    expect(formatJourneyDuration(26)).toBe('1 d 2 h');
    expect(formatJourneyDuration(null)).toBe('Em andamento');
  });
});
