import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import RouteLearning, { RoutePlanReview } from './RouteLearning';
jest.mock('axios');
jest.mock('../components/Header', () => () => <div>Cabeçalho</div>);
const api = axios as jest.Mocked<typeof axios>;
const stop = { id: 1, key: 'customer-address', customer: 'CDS', address: 'Rua A', invoice: '123', companyId: 2 };
const plan = { id: 8, tripId: 4, driverId: 7, companyId: 1, operationDate: '2026-10-09', routeName: 'Campinas', source: 'driver', before: [stop], after: [stop], changes: [{ stopId: 1, reason: 'customer_hours', scope: 'today', note: '' }], review: null };
beforeEach(() => jest.clearAllMocks());
it('sends the corrected reason while preserving the original driver report', async () => {
  api.post.mockResolvedValue({ data: { accepted: true } }); const refreshed = jest.fn().mockResolvedValue(undefined);
  render(<RoutePlanReview plan={plan} onReviewed={refreshed} />);
  fireEvent.change(screen.getByLabelText('Motivo de CDS, Rua A'), { target: { value: 'customer_unavailable' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar explicações e revisar plano' }));
  await waitFor(() => expect(refreshed).toHaveBeenCalledTimes(1));
  expect(api.post).toHaveBeenCalledWith(expect.stringContaining('/8/review'), { decision: 'approve', changes: [{ ...plan.changes[0], reason: 'customer_unavailable' }] });
  expect(plan.changes[0].reason).toBe('customer_hours');
  expect(screen.getByText(/CDS · Rua A: Horário do cliente/)).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Revisão preservada');
});
it('shows a failed query as an error rather than an empty queue', async () => {
  api.get.mockRejectedValue(new Error('offline')); render(<RouteLearning />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível consultar');
  expect(screen.queryByText('Nenhum plano registrado nesta página.')).not.toBeInTheDocument();
});
