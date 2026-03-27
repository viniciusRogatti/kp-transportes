import { IDanfe, IReceiptBacklogRow, ITrip } from '../../types/types';
import {
  canDanfeAppearInRoutingPool,
  evaluateRoutePlanningDecision,
  findActiveAssignmentForInvoice,
  getRetainedContextsForNote,
  groupRetainedRowsByCustomerId,
  isRoutePlanningTripActive,
} from '../routePlanningRules';

function buildTrip(overrides: Partial<ITrip> = {}): ITrip {
  return {
    id: 10,
    driver_id: 7,
    car_id: 3,
    created_at: '2026-03-26T08:00:00.000Z',
    updated_at: '2026-03-26T08:00:00.000Z',
    date: '2026-03-26',
    gross_weight: 100,
    run_number: 1,
    Driver: {
      id: 7,
      name: 'Motorista Teste',
    },
    Car: {
      id: 3,
      model: 'Truck',
      license_plate: 'ABC-1234',
    },
    TripNotes: [],
    ...overrides,
  };
}

function buildDanfe(overrides: Partial<IDanfe> = {}): IDanfe {
  return {
    customer_id: 'CUST-1',
    invoice_number: '1722001',
    status: 'pending',
    barcode: 'barcode-1722001',
    invoice_date: '2026-03-25',
    departure_time: '08:00:00',
    total_quantity: 1,
    gross_weight: '10',
    net_weight: '9',
    total_value: '100',
    created_at: '2026-03-25T08:00:00.000Z',
    updated_at: '2026-03-25T08:00:00.000Z',
    Customer: {
      name_or_legal_entity: 'Cliente Teste',
      phone: null,
      address: 'Rua A',
      city: 'Campinas',
      cnpj_or_cpf: '00000000000000',
    },
    DanfeProducts: [],
    ...overrides,
  };
}

describe('routePlanningRules', () => {
  it('libera NF pendente e NF de reentrega para roteirizacao', () => {
    const pendingDecision = evaluateRoutePlanningDecision({
      danfe: buildDanfe({
        invoice_number: '1722000',
        status: 'pending',
      }),
    });
    const redeliveryDecision = evaluateRoutePlanningDecision({
      danfe: buildDanfe({
        invoice_number: '1722009',
        status: 'redelivery',
      }),
    });

    expect(pendingDecision.outcome).toBe('allow');
    expect(pendingDecision.reason).toBe('pending');
    expect(redeliveryDecision.outcome).toBe('allow');
    expect(redeliveryDecision.reason).toBe('redelivery');
  });

  it('considera rota inativa quando todas as notas ja estao em status final operacional', () => {
    const trip = buildTrip({
      TripNotes: [
        {
          invoice_number: '1722001',
          status: 'retained',
          order: 1,
          city: 'Campinas',
          gross_weight: '10',
        },
        {
          invoice_number: '1722002',
          status: 'redelivery',
          order: 2,
          city: 'Campinas',
          gross_weight: '10',
        },
      ],
    });

    expect(isRoutePlanningTripActive(trip)).toBe(false);
  });

  it('localiza a atribuicao ativa da NF e ignora rotas ja finalizadas', () => {
    const assignment = findActiveAssignmentForInvoice([
      buildTrip({
        id: 11,
        Driver: { id: 8, name: 'Outro Motorista' },
        TripNotes: [
          {
            id: 99,
            invoice_number: '1722001',
            status: 'assigned',
            order: 1,
            city: 'Campinas',
            gross_weight: '10',
          },
        ],
      }),
      buildTrip({
        id: 12,
        TripNotes: [
          {
            id: 100,
            invoice_number: '1722001',
            status: 'delivered',
            order: 1,
            city: 'Campinas',
            gross_weight: '10',
          },
        ],
      }),
    ], '1722001');

    expect(assignment).not.toBeNull();
    expect(assignment?.tripId).toBe(11);
    expect(assignment?.noteId).toBe(99);
    expect(assignment?.driverName).toBe('Outro Motorista');
  });

  it('bloqueia NF atribuida quando existe rota ativa vinculada', () => {
    const decision = evaluateRoutePlanningDecision({
      danfe: buildDanfe({
        invoice_number: '1722010',
        status: 'assigned',
      }),
      assignment: {
        tripId: 44,
        tripDate: '2026-03-26',
        driverName: 'Motorista Atual',
        noteId: 551,
      },
    });

    expect(decision.outcome).toBe('assignment_conflict');
    expect(decision.assignment.driverName).toBe('Motorista Atual');
    expect(decision.assignment.tripId).toBe(44);
  });

  it('bloqueia NF cancelada e direciona para a substituta quando houver refaturamento', () => {
    const decision = evaluateRoutePlanningDecision({
      danfe: buildDanfe({
        invoice_number: '1722003',
        status: 'cancelled',
        replacement_invoice_number: '1722999',
      }),
    });

    expect(decision.outcome).toBe('blocked');
    if (decision.outcome !== 'blocked') {
      throw new Error(`Resultado inesperado: ${decision.outcome}`);
    }
    expect(decision.reason).toBe('cancelled_replaced');
    expect(decision.replacementInvoiceNumber).toBe('1722999');
  });

  it('libera NF devolvida quando nao existe devolucao ativa vinculada', () => {
    const decision = evaluateRoutePlanningDecision({
      danfe: buildDanfe({
        invoice_number: '1722004',
        status: 'returned',
      }),
      activeReturn: null,
    });

    expect(decision.outcome).toBe('allow');
    expect(decision.reason).toBe('returned_cleared');
  });

  it('bloqueia NF devolvida quando existe devolucao ativa', () => {
    const decision = evaluateRoutePlanningDecision({
      danfe: buildDanfe({
        invoice_number: '1722011',
        status: 'returned',
      }),
      activeReturn: {
        batchCode: 'RET-123',
        returnType: 'total',
        returnDate: '2026-03-26',
      },
    });

    expect(decision.outcome).toBe('blocked');
    if (decision.outcome !== 'blocked') {
      throw new Error(`Resultado inesperado: ${decision.outcome}`);
    }
    expect(decision.reason).toBe('returned_active');
    expect(decision.returnInfo?.batchCode).toBe('RET-123');
  });

  it('bloqueia NF em canhoto retido como entrega comum', () => {
    const decision = evaluateRoutePlanningDecision({
      danfe: buildDanfe({
        invoice_number: '1722012',
        status: 'retained',
      }),
    });

    expect(decision.outcome).toBe('blocked');
    if (decision.outcome !== 'blocked') {
      throw new Error(`Resultado inesperado: ${decision.outcome}`);
    }
    expect(decision.reason).toBe('retained');
  });

  it('agrupa pendencias de canhoto retido pelo customer_id', () => {
    const backlogRows: IReceiptBacklogRow[] = [
      {
        queue_type: 'retained',
        nf_id: '1722005',
        invoice_number: '1722005',
        customer_id: 'CUST-1',
        status: 'PENDING',
      },
      {
        queue_type: 'retained',
        nf_id: '1722006',
        invoice_number: '1722006',
        customer_id: 'CUST-1',
        status: 'PENDING',
      },
    ];

    const retainedByCustomerId = groupRetainedRowsByCustomerId(backlogRows);
    const contexts = getRetainedContextsForNote({
      customer_id: 'CUST-1',
    }, retainedByCustomerId);

    expect(contexts).toHaveLength(2);
    expect(canDanfeAppearInRoutingPool('assigned')).toBe(true);
    expect(canDanfeAppearInRoutingPool('retained')).toBe(false);
  });
});
