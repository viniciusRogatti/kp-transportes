import React from 'react';
import { TextDecoder, TextEncoder } from 'util';
import type { DailyOperationReport } from '../../services/dailyOperationClosingService';

(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

const { renderToBuffer } = require('@react-pdf/renderer');
const DailyOperationClosingPDF = require('../DailyOperationClosingPDF').default;

const report: DailyOperationReport = {
  operation_date: '2026-08-20', generated_at: '2026-08-21T08:00:00.000Z', status: 'closed',
  notes: 'Operação concluída.', closed_at: '2026-08-21T08:00:00.000Z', closed_by_name: 'Gerente',
  summary: {
    opening_pending: 3, received_today: 20, total_notes_assigned: 18, delivered: 15,
    redelivery: 1, returned: 1, cancelled: 1, retained: 0, pending_route_completion: 0,
    pending_receipts: 2, pending_delivery: 3, open_occurrences: 1, routes: 2,
    vehicles_used: 2, total_weight: 1400, total_boxes: 80, loading_minutes: 70, loadings_informed: 2,
  },
  routes: [{
    trip_id: 1, run_number: 1, company_name: 'Mar e Rio', driver_name: 'Diogo',
    vehicle: 'Caminhão - ABC1D23', license_plate: 'ABC1D23', total_notes: 10,
    total_weight: 800, total_boxes: 50, delivered: 10, pending: 0, duration_minutes: 32,
    loading_notes: '', loading_updated_by: 'Conferente',
  }],
  pending_deliveries: [{
    company_id: 1, company_name: 'Mar e Rio', invoice_number: '123', customer_name: 'Cliente',
    city: 'Campinas', status: 'pending', invoice_date: '2026-08-19', pending_days: 1,
    gross_weight: 20, box_quantity: 2,
  }],
  companies: [{ company_id: 1, company_name: 'Mar e Rio', total: 18, delivered: 15, pending_delivery: 3 }],
};

describe('DailyOperationClosingPDF', () => {
  it('gera o relatório consolidado em PDF', async () => {
    // O retorno é um Buffer de PDF, não o resultado de render do Testing Library.
    // eslint-disable-next-line testing-library/render-result-naming-convention
    const pdfBuffer = await renderToBuffer(<DailyOperationClosingPDF report={report} />);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.subarray(0, 4).toString()).toBe('%PDF');
  }, 30000);
});
