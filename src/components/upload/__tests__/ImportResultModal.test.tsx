import { fireEvent, render, screen } from '@testing-library/react';
import ImportResultModal from '../ImportResultModal';
import { IUploadImportReportResponse } from '../../../types/upload';

const handlers = {
  onClose: jest.fn(),
  onRetryErrors: jest.fn(),
  onDownload: jest.fn(),
  onOpenCnpjRegistration: jest.fn(),
  onShowFullReport: jest.fn(),
};

const duplicateReport: IUploadImportReportResponse = {
  summary: {
    selected: 2,
    processed: 2,
    success: 2,
    failed: 0,
    newProducts: 0,
    updatedProducts: 0,
    createdInvoices: 0,
    updatedInvoices: 0,
    ignoredInvoices: 2,
    importedInvoices: 0,
  },
  results: [],
  newProducts: [],
  updatedProducts: [],
};

describe('ImportResultModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deixa claro quando todos os XMLs ja existiam', () => {
    render(
      <ImportResultModal
        isOpen
        report={duplicateReport}
        unregisteredCompanyCount={0}
        {...handlers}
      />,
    );

    expect(screen.getByText('Nenhum arquivo novo foi importado')).toBeInTheDocument();
    expect(screen.getByText(/todos os XMLs selecionados já existiam/i)).toBeInTheDocument();
  });

  it('oferece cadastro de CNPJ e reenvio quando o erro permite correcao', () => {
    const errorReport: IUploadImportReportResponse = {
      ...duplicateReport,
      summary: {
        ...duplicateReport.summary,
        selected: 1,
        processed: 1,
        success: 0,
        failed: 1,
        ignoredInvoices: 0,
      },
      results: [{
        fileName: 'empresa-nova.xml',
        status: 'error',
        error: {
          code: 'XML_COMPANY_UNREGISTERED',
          message: 'Emitente não cadastrado.',
          details: 'CNPJ 00.000.000/0000-00.',
        },
      }],
    };

    render(
      <ImportResultModal
        isOpen
        report={errorReport}
        unregisteredCompanyCount={1}
        {...handlers}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar novo CNPJ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar arquivos com erro' }));

    expect(handlers.onOpenCnpjRegistration).toHaveBeenCalledTimes(1);
    expect(handlers.onRetryErrors).toHaveBeenCalledTimes(1);
    expect(screen.getByText('CNPJ do emitente não cadastrado')).toBeInTheDocument();
  });
});
