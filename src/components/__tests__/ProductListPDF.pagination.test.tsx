import React from 'react';
import { TextDecoder, TextEncoder } from 'util';

(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

const { renderToBuffer } = require('@react-pdf/renderer');
const {
  default: ProductListPDF,
  buildNumberedProductGroups,
} = require('../ProductListPDF');

const buildDanfes = (count: number) => Array.from({ length: count }, (_, index) => ({
  invoice_number: String(1000 + index),
  invoice_date: '2026-07-30',
  Customer: {
    name_or_legal_entity: `Cliente ${index + 1}`,
    city: index % 2 ? 'Campinas' : 'Santos',
  },
}));

const buildProducts = (count: number) => Array.from({ length: count }, (_, index) => ({
  company_name: index < Math.ceil(count / 2) ? 'MAR E RIO' : 'BRAZILIAN FISH',
  code: String(100 + index),
  description: `PRODUTO PARA TESTE DE PAGINACAO ${index + 1}`,
  type: 'CX',
  quantity: index + 1,
}));

const buildOccurrenceReminders = (count: number) => Array.from({ length: count }, (_, index) => ({
  occurrenceId: index + 1,
  customerName: `Cliente com ocorrencia operacional ${index + 1}`,
  invoiceNumber: String(1000 + index),
  ageBusinessDays: 3,
  reasonLabel: 'Mercadoria faltante',
  itemSummary: 'Produto de teste que precisa de uma descricao suficientemente longa para ocupar espaco',
  actionLabel: 'Recolher mercadoria.',
  routeInvoiceNumbers: [String(1000 + index)],
}));

const countPdfPages = (buffer: Buffer) => (
  (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length
);

describe('ProductListPDF - paginação', () => {
  it('numera continuamente as linhas mesmo quando existem varias empresas', () => {
    const groups = buildNumberedProductGroups([
      { company_name: 'EMPRESA A', code: 'A1', description: 'Produto A1', type: 'CX', quantity: 1 },
      { company_name: 'EMPRESA B', code: 'B1', description: 'Produto B1', type: 'CX', quantity: 1 },
      { company_name: 'EMPRESA A', code: 'A2', description: 'Produto A2', type: 'CX', quantity: 1 },
    ]);

    expect(groups.map(([companyName, rows]: [string, Array<{ lineNumber: number }>]) => ({
      companyName,
      lineNumbers: rows.map((row) => row.lineNumber),
    }))).toEqual([
      { companyName: 'EMPRESA A', lineNumbers: [1, 2] },
      { companyName: 'EMPRESA B', lineNumbers: [3] },
    ]);
  });

  it('não cria uma folha vazia depois de remover as linhas de salmão', async () => {
    // O retorno e um Buffer de PDF, nao o resultado do render do Testing Library.
    // eslint-disable-next-line testing-library/render-result-naming-convention
    const pdfBuffer = await renderToBuffer(
      <ProductListPDF
        products={buildProducts(10)}
        salmonSeparations={[]}
        prontoBoxes={[]}
        danfes={buildDanfes(14) as any}
        occurrenceReminders={buildOccurrenceReminders(8) as any}
        driver="Robson"
        vehiclePlate="CUD6309"
        tripId={1809}
        tripDate="30-07-2026"
        noteCount={14}
      />,
    );

    expect(countPdfPages(pdfBuffer)).toBe(1);
  }, 30000);
});
