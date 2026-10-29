import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CoveragePanel from './CoveragePanel';
import { trainingApi, type CoveragePage } from './api';
jest.mock('./api', () => ({ ...jest.requireActual('./api'), trainingApi: { coverage: jest.fn() } }));
const api = trainingApi.coverage as jest.MockedFunction<typeof trainingApi.coverage>;
const result: CoveragePage = { dateFrom: '2026-10-01', dateTo: '2026-10-28', referenceDate: '2026-10-29', generatedAt: '2026-10-29T00:00:00Z', nextCursor: 128,
  items: [{ tripId: 128, companyId: 1, driverId: 9, driverName: 'Motorista fictício', operationDate: '2026-10-28', routeName: 'Campinas', exampleVersion: null, totalVisits: 3, referencedCount: 1, missingCount: 2, identityCount: 1, truncated: false, trainingExample: { id: 1, tripId: 100, version: 2, routeName: 'Circuito' }, explanation: 'Exemplo compatível.', missing: [
    { key: 'A', customer: 'Cliente sem sequência', customerId: 'A', companyId: 1, address: 'Rua A', invoices: ['1001'], stopIds: [1], state: 'needs_sequence' },
    { key: 'B', customer: 'Cliente sem local confiável', customerId: 'B', companyId: 2, address: 'Rua B', invoices: ['2001'], stopIds: [2], state: 'check_identity' },
  ] }] };
beforeEach(() => { jest.resetAllMocks(); api.mockResolvedValue(result); });
test('analisa sob demanda, distingue falta de sequência/local e abre o cadastro correto', async () => {
  const open = jest.fn(); render(<CoveragePanel onOpen={open} />); expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Analisar viagens' }));
  await screen.findByText('Cliente sem sequência');
  expect(screen.getByText(/1 de 3 com referência/)).toBeInTheDocument();
  expect(screen.getByText(/cadastrar mais fotos sozinho pode não resolver/)).toBeInTheDocument();
  expect(screen.getByText(/Simulação para 29\/10\/2026/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar exemplo desta viagem' })); expect(open).toHaveBeenCalledWith('128');
});
test('falha é explícita e não apresenta cobertura zero ou todas as rotas treinadas', async () => {
  api.mockRejectedValueOnce(new Error('Base indisponível.')); render(<CoveragePanel onOpen={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Analisar viagens' }));
  await screen.findByText('Base indisponível.'); expect(screen.queryByLabelText('Cobertura das viagens exibidas')).not.toBeInTheDocument();
  expect(screen.queryByText(/Nenhuma viagem encontrada/)).not.toBeInTheDocument();
});
test('paginação conserva período consultado mesmo se os campos forem editados e filtra contadores junto da lista', async () => {
  api.mockResolvedValueOnce(result).mockResolvedValueOnce({ ...result, nextCursor: null, items: [{ ...result.items[0], tripId: 127, routeName: 'Limeira', missing: [], missingCount: 0, identityCount: 0, totalVisits: 2, referencedCount: 2 }] });
  render(<CoveragePanel onOpen={jest.fn()} />); fireEvent.click(screen.getByRole('button', { name: 'Analisar viagens' })); await screen.findByText('Campinas');
  const first = api.mock.calls[0][0];
  fireEvent.change(screen.getByLabelText('Viagens desde'), { target: { value: '2026-01-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Analisar mais viagens' })); await screen.findByText('Limeira');
  expect(api).toHaveBeenLastCalledWith({ ...first, before: 128 });
  fireEvent.click(screen.getByLabelText('Só viagens com lacunas')); expect(screen.queryByText('Limeira')).not.toBeInTheDocument();
  expect(screen.getByText('Campinas')).toBeInTheDocument();
});
test('ID específico e erro de atualização preservam resultados identificados como anteriores', async () => {
  api.mockResolvedValueOnce(result).mockRejectedValueOnce(new Error('Falha ao atualizar.'));
  render(<CoveragePanel onOpen={jest.fn()} />); fireEvent.change(screen.getByLabelText('Ou um ID de viagem'), { target: { value: '128' } }); fireEvent.click(screen.getByRole('button', { name: 'Analisar viagens' }));
  await screen.findByText('Campinas'); expect(api).toHaveBeenCalledWith(expect.objectContaining({ tripId: '128' }));
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar diagnóstico' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Os resultados abaixo são da consulta anterior.'));
  expect(screen.getByText('Campinas')).toBeInTheDocument();
});
