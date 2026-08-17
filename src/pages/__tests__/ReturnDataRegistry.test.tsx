import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import ReturnDataRegistry from '../ReturnDataRegistry';
import verifyToken from '../../utils/verifyToken';

jest.mock('axios');
jest.mock('../../utils/verifyToken');
jest.mock('../../components/Header', () => () => <div>Header</div>);
jest.mock('echarts-for-react', () => () => <div data-testid="chart" />);
jest.mock('react-router', () => ({
  useNavigate: () => jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

const overview = {
  metrics: {
    total_occurrences: 4,
    distinct_invoices: 3,
    approved_occurrences: 2,
    rejected_occurrences: 1,
    unknown_occurrences: 1,
    approval_rate: 50,
    involved_value: 1500,
    distinct_customers: 3,
    unlinked_occurrences: 2,
  },
  charts: {
    customers: [{ label: 'Cliente A', count: 2 }],
    reasons: [{ label: 'Mercadoria faltante', count: 2 }],
    sellers: [{ label: 'Representante A', count: 2 }],
    products: [{ label: 'Produto A', count: 2 }],
    return_types: [{ label: 'partial', count: 2 }],
    approval_statuses: [{ label: 'approved', count: 2 }],
  },
  latest_import: {
    id: 1,
    original_file_name: 'base.xlsx',
    imported_at: '2026-07-29T14:30:00.000Z',
  },
};

describe('ReturnDataRegistry', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'token-teste');
    localStorage.setItem('user_permission', 'admin');
    mockedVerifyToken.mockResolvedValue(true as never);
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/occurrences/overview')) return Promise.resolve({ data: overview });
      if (url.endsWith('/return-data/imports')) return Promise.resolve({ data: [] });
      if (url.endsWith('/return-data/occurrences')) {
        return Promise.resolve({
          data: {
            rows: [],
            total: 0,
            page: 1,
            limit: 25,
            total_pages: 1,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
    mockedAxios.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('exibe indicadores e acesso às três abas', async () => {
    render(<ReturnDataRegistry />);

    expect(await screen.findByText('Base de devoluções')).toBeInTheDocument();
    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.getByText('NFs distintas')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.500,00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /visão geral/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ocorrências/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /importações/i })).toBeInTheDocument();
  });

  it('abre o calendário ao clicar nos filtros de período', async () => {
    const showPicker = jest.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      configurable: true,
      value: showPicker,
    });

    try {
      render(<ReturnDataRegistry />);
      fireEvent.click(await screen.findByLabelText('Período inicial da base'));
      fireEvent.click(screen.getByLabelText('Período final da base'));
      expect(showPicker).toHaveBeenCalledTimes(2);
    } finally {
      delete (HTMLInputElement.prototype as any).showPicker;
    }
  });

  it('pré-visualiza o arquivo antes de permitir confirmar a importação', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        duplicate_file: false,
        file_name: 'base.xlsx',
        file_sha256: 'hash',
        total_rows: 12,
        total_occurrences: 10,
        created_occurrences: 7,
        updated_occurrences: 2,
        unchanged_occurrences: 1,
        approved_count: 8,
        rejected_count: 2,
        invalid_occurrences: 0,
        warnings_count: 0,
        errors_count: 0,
      },
    });

    render(<ReturnDataRegistry />);
    fireEvent.click(await screen.findByRole('button', { name: /importações/i }));

    const file = new File(['xlsx'], 'base.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(screen.getByLabelText('Planilha da base de devoluções'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: /pré-visualizar/i }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/return-data/imports/preview'),
        expect.any(FormData),
      );
    });
    expect(await screen.findByText('10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar importação/i })).toBeInTheDocument();
  });

  it('bloqueia a confirmação quando a transportadora é divergente', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        duplicate_file: false,
        file_name: 'outra-transportadora.xlsx',
        file_sha256: 'hash-divergente',
        total_occurrences: 32,
        errors_count: 1,
        warnings_count: 0,
        carrier_mismatch: true,
        expected_carrier: 'KP TRANSPORTES',
        other_carriers: ['FRIGUS TRANSPORTE E LOGISTICA LTDA'],
      },
    });

    render(<ReturnDataRegistry />);
    fireEvent.click(await screen.findByRole('button', { name: /importações/i }));
    fireEvent.change(screen.getByLabelText('Planilha da base de devoluções'), {
      target: { files: [new File(['xlsx'], 'outra-transportadora.xlsx')] },
    });
    fireEvent.click(screen.getByRole('button', { name: /pré-visualizar/i }));

    expect(await screen.findByText(/importação bloqueada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar importação/i })).toBeDisabled();
  });

  it('mostra ocorrências fora de lote e exige confirmação para desfazer', async () => {
    const imported = {
      id: 9,
      original_file_name: 'frigus.xlsx',
      file_sha256: 'hash',
      file_size: 100,
      import_status: 'confirmed',
      imported_by_username: 'admin',
      imported_at: '2026-08-17T12:00:00.000Z',
      confirmed_at: '2026-08-17T12:00:00.000Z',
      detected_start_date: null,
      detected_end_date: null,
      total_rows: 1,
      total_occurrences: 1,
      created_occurrences: 1,
      updated_occurrences: 0,
      unchanged_occurrences: 0,
      invalid_occurrences: 0,
      warnings_count: 0,
      errors_count: 0,
      membership_complete: true,
    };
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/occurrences/overview')) return Promise.resolve({ data: overview });
      if (url.endsWith('/return-data/imports')) return Promise.resolve({ data: [imported] });
      if (url.endsWith('/imports/9/reversal-impact')) return Promise.resolve({
        data: {
          import: imported,
          is_latest: true,
          membership_complete: true,
          total_occurrences: 1,
          linked_occurrences: 0,
          pending_occurrences: 1,
          created_occurrences: 1,
          updated_occurrences: 0,
          unchanged_occurrences: 0,
          can_reverse_without_confirmation: false,
          occurrences: [],
          pending: [{
            membership_id: 1,
            registry_occurrence_id: 11,
            source_occurrence_id: 'OC-1',
            invoice_number: '12345',
            customer_name: 'Cliente teste',
            import_action: 'created',
            linked_to_batch: false,
          }],
        },
      });
      return Promise.resolve({ data: {} });
    });
    mockedAxios.delete.mockResolvedValue({ data: { message: 'Importação desfeita com sucesso.' } });

    render(<ReturnDataRegistry />);
    fireEvent.click(await screen.findByRole('button', { name: /importações/i }));
    fireEvent.click(await screen.findByRole('button', { name: /analisar exclusão/i }));

    expect(await screen.findByText('NF')).toBeInTheDocument();
    expect(screen.getByText('12345')).toBeInTheDocument();
    const reverseButton = screen.getByRole('button', { name: /desfazer importação/i });
    expect(reverseButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/confirmo que desejo excluir/i));
    expect(reverseButton).toBeEnabled();
    fireEvent.click(reverseButton);

    await waitFor(() => expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/return-data/imports/9'),
      expect.objectContaining({ data: expect.objectContaining({ confirm_pending: true }) }),
    ));
  });

  it('corrige o tipo sem apagar a classificação importada', async () => {
    const occurrence = {
      id: 8356,
      source_occurrence_id: '8356',
      invoice_number: '1816619',
      invoice_number_normalized: '1816619',
      invoice_total_value: 1212.72,
      calculated_return_value: null,
      return_value_source: 'unavailable',
      invoice_issued_at: '2026-07-21',
      customer_name: 'SUPERMERCADO BIG BOM LTDA',
      customer_tax_id: '50582170000442',
      seller_name: 'VALENTIN FIORINI',
      return_reason_raw: '3 PEÇAS ESTÃO SEM VACUO',
      return_reason_category: 'Produto avariado ou fora do padrão',
      return_justification: 'Produto avariado',
      approval_justification: 'PRODUTO FORA DAS CONFORMIDADES',
      approval_status: 'approved',
      carrier_name: 'KP TRANSPORTES',
      redelivery_carrier_name: null,
      inferred_return_type: 'unclassified',
      return_type_source: 'unclassified',
      operational_return_type: null,
      effective_return_type: 'unclassified',
      effective_return_type_source: 'unclassified',
      return_type_corrected_at: null,
      return_type_corrected_by_user_id: null,
      return_type_corrected_by_username: null,
      first_seen_at: '2026-07-30T22:27:00.000Z',
      last_seen_at: '2026-07-30T22:27:00.000Z',
      linked_batch_code: null,
      items: [],
    };
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/occurrences/overview')) return Promise.resolve({ data: overview });
      if (url.endsWith('/return-data/imports')) return Promise.resolve({ data: [] });
      if (url.endsWith('/return-data/occurrences')) {
        return Promise.resolve({
          data: { rows: [occurrence], total: 1, page: 1, limit: 25, total_pages: 1 },
        });
      }
      return Promise.resolve({ data: {} });
    });
    mockedAxios.patch.mockResolvedValueOnce({
      data: {
        ...occurrence,
        operational_return_type: 'partial',
        effective_return_type: 'partial',
        effective_return_type_source: 'operational_correction',
        return_type_corrected_by_user_id: 7,
        return_type_corrected_by_username: 'expedicao',
        return_type_corrected_at: '2026-07-30T23:00:00.000Z',
      },
    });

    render(<ReturnDataRegistry />);
    fireEvent.click(await screen.findByRole('button', { name: /ocorrências/i }));
    fireEvent.click(await screen.findByRole('button', { name: /ID 8356/i }));
    fireEvent.click(screen.getByRole('button', { name: /corrigir tipo/i }));
    fireEvent.change(screen.getByLabelText('Corrigir tipo da ocorrência 8356'), {
      target: { value: 'partial' },
    });
    fireEvent.click(screen.getByRole('button', { name: /salvar correção/i }));

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/return-data/occurrences/8356/return-type'),
        { return_type: 'partial' },
      );
    });
    expect(await screen.findByText('Corrigido pela operação')).toBeInTheDocument();
    expect(screen.getByText(/Importado como Não classificado/)).toBeInTheDocument();
  });
});
