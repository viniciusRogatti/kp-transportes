import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { CustomerOperationsPanel } from './CustomerOperationsPanel';
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }));
const api = axios as jest.Mocked<typeof axios>;
const profile = { policy: { alertAfterMinutes: 20, source: 'default' }, canConfigure: true, learning: { samples: 0, meanServiceMinutes: null, windowDays: 90, truncated: false, locations: [] } };
beforeEach(() => jest.clearAllMocks());
test('loads explicit statistics and saves a market limit with company and customer identity', async () => {
  api.get.mockResolvedValue({ data: profile }); api.put.mockResolvedValue({ data: { policy: { alertAfterMinutes: 60, source: 'team' } } });
  render(<CustomerOperationsPanel companyId={2} customerId="12345678000199" />);
  fireEvent.click(screen.getByText('Tempos e alertas deste cliente'));
  expect(await screen.findByText(/Ainda não há atendimentos/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Preencher 60 min · mercado'));
  expect(api.put).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Salvar limite'));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith(expect.stringContaining('/customers/2/12345678000199/operations'), { alertAfterMinutes: 60 }));
  expect(await screen.findByText('Tempo salvo para este cliente.')).toBeInTheDocument();
});
test('an unavailable history is an error rather than a zero average', async () => {
  api.get.mockRejectedValue(new Error('offline'));
  render(<CustomerOperationsPanel companyId={1} customerId="A" />);
  fireEvent.click(screen.getByText('Tempos e alertas deste cliente'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível consultar');
  expect(screen.queryByText(/Ainda não há atendimentos/)).not.toBeInTheDocument();
});
test('read-only staff cannot edit policy', async () => {
  api.get.mockResolvedValue({ data: { ...profile, canConfigure: false } });
  render(<CustomerOperationsPanel companyId={1} customerId="A" />);
  fireEvent.click(screen.getByText('Tempos e alertas deste cliente'));
  await screen.findByText(/Ainda não há atendimentos/);
  expect(screen.queryByText('Salvar limite')).not.toBeInTheDocument();
});
