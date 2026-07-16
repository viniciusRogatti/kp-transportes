import { IImportResult } from '../../types/upload';
import { getImportErrorPresentation } from '../importErrorPresentation';
import { calculateImportSummary } from '../uploadReport';

const duplicateResult = (updatedInvoices: number): IImportResult => ({
  fileName: 'duplicada.xml',
  status: 'success',
  warnings: [{ code: 'DUPLICATE_INVOICE', message: 'NF já existe.' }],
  meta: {
    origin: 'EMPRESA TESTE',
    invoiceNumber: '123456',
    createdProducts: 0,
    updatedProducts: 0,
    createdInvoices: 0,
    updatedInvoices,
    ignoredInvoices: 0,
  },
});

describe('relatório de importação de XML', () => {
  it('conta nota já existente como ignorada, nunca como importada ou atualizada', () => {
    const summary = calculateImportSummary(1, [duplicateResult(1)], [], []);

    expect(summary.processed).toBe(1);
    expect(summary.ignoredInvoices).toBe(1);
    expect(summary.updatedInvoices).toBe(0);
    expect(summary.importedInvoices).toBe(0);
  });

  it('diferencia estrutura inválida, campo ausente e CNPJ não cadastrado', () => {
    expect(getImportErrorPresentation({ code: 'XML_STRUCTURE_INVALID', message: '' }).title)
      .toBe('Arquivo não é uma NF-e processada');
    expect(getImportErrorPresentation({ code: 'XML_ACCESS_KEY_MISSING', message: '' }).title)
      .toBe('Chave de acesso da NF-e ausente');
    expect(getImportErrorPresentation({ code: 'XML_COMPANY_UNREGISTERED', message: '' }).hint)
      .toMatch(/cadastre-o/i);
  });
});
