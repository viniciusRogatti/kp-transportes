import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AstroTraining from '../AstroTraining';
import { trainingApi, type TrainingTrip } from '../../features/astroTraining/api';
import { draftKey, readDraft, writeDraft } from '../../features/astroTraining/storage';
import { initialDraft } from '../../features/astroTraining/draft';
import { canAccessAstroTraining } from '../../utils/permissions';

jest.mock('../../components/Header', () => () => null);
jest.mock('../../features/astroTraining/api', () => ({ ...jest.requireActual('../../features/astroTraining/api'), trainingApi: { trip: jest.fn(), list: jest.fn(), save: jest.fn() } }));
const api = trainingApi as jest.Mocked<typeof trainingApi>;
const trip: TrainingTrip = {
  trip: { id: 128, companyId: 1, driverId: 3, driverName: 'Motorista fictício', operationDate: '2026-10-28' },
  sourceRevision: 'revision-1', example: null,
  stops: [
    { id: '1', key: 'client-a', customer: 'Cliente A', address: 'Rua A · Campinas', invoice: '10001', companyId: 1, weightKg: null },
    { id: '2', key: 'client-a', customer: 'Cliente A', address: 'Rua A · Campinas', invoice: '10002', companyId: 1, weightKg: null },
    { id: '3', key: 'client-b', customer: 'Cliente B', address: 'Rua B · Limeira', invoice: '20003', companyId: 2, weightKg: null },
  ],
};
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear();
  localStorage.setItem('user_login', 'Rogatti'); localStorage.setItem('company_id', '1');
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: jest.fn().mockReturnValue('request-test-1') } });
  api.trip.mockResolvedValue(trip); api.save.mockResolvedValue({ accepted: true, version: 1, exampleId: 7 });
  api.list.mockResolvedValue({ items: [], nextCursor: null });
});
const openTrip = async () => {
  fireEvent.change(screen.getByLabelText('ID da viagem'), { target: { value: '128' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar viagem' }));
  await screen.findByText('Viagem #128');
  await waitFor(() => expect(screen.getByLabelText('Nome do exemplo')).toBeEnabled());
};
const nameExample = () => fireEvent.change(screen.getByLabelText('Nome do exemplo'), { target: { value: 'Circuito de teste' } });
test('confere a sequência, mantém notas omitidas e exige confirmar a separação antes do PUT', async () => {
  render(<AstroTraining />); await openTrip(); nameExample();
  fireEvent.change(screen.getByRole('textbox', { name: 'Sequência de NFs' }), { target: { value: '001 003' } });
  fireEvent.click(screen.getByRole('button', { name: 'Conferir sequência' }));
  expect(screen.getByText(/1 NFs não informadas ficarão ao final/)).toBeInTheDocument();
  expect(api.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar esta sequência' }));
  const rows = within(screen.getByRole('list', { name: 'Sequência de NFs' })).getAllByRole('listitem');
  expect(rows[1]).toHaveTextContent('NF 20003');
  fireEvent.click(screen.getByRole('button', { name: 'Salvar exemplo' }));
  expect(api.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar separação e salvar' }));
  await screen.findByText('Exemplo salvo na base · revisão 1');
  expect(api.save).toHaveBeenCalledWith(128, expect.objectContaining({ stopIds: [1, 3, 2], separatedStopIds: [2], expectedVersion: 0, sourceRevision: 'revision-1', routeName: 'Circuito de teste' }));
  expect(localStorage.getItem(draftKey(trip))).toBeNull();
});
test('timeout preserva rascunho e identificador para repetir após recarregar a página', async () => {
  api.save.mockRejectedValueOnce(new Error('Resposta perdida.'));
  const view = render(<AstroTraining />); await openTrip(); nameExample();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar exemplo' }));
  await screen.findByText('Resposta perdida.');
  expect(screen.queryByText(/Exemplo salvo na base/)).not.toBeInTheDocument();
  const first = api.save.mock.calls[0][1];
  expect(JSON.parse(localStorage.getItem(draftKey(trip))!)).toEqual(expect.objectContaining({ request: { fingerprint: expect.any(String), clientEventId: expect.any(String) } }));
  expect(readDraft(draftKey(trip))?.request?.clientEventId).toBe(first.clientEventId);
  view.unmount(); render(<AstroTraining />); await openTrip();
  expect(screen.getByLabelText('Nome do exemplo')).toHaveValue('Circuito de teste');
  fireEvent.click(screen.getByRole('button', { name: 'Salvar exemplo' }));
  await screen.findByText('Exemplo salvo na base · revisão 1');
  expect(api.save.mock.calls[1][1]).toEqual(first);
});
test('falha da consulta não mostra zero exemplos; paginação mantém itens anteriores', async () => {
  const summary = { id: 7, tripId: 128, companyId: 1, driverId: 3, driverName: 'Motorista fictício', operationDate: '2026-10-28', routeName: 'Circuito', version: 2, updatedAt: '', includedCount: 3, excludedCount: 0 };
  api.list.mockRejectedValueOnce(new Error('Consulta indisponível.')).mockResolvedValueOnce({ items: [summary], nextCursor: 7 }).mockResolvedValueOnce({ items: [{ ...summary, id: 6, tripId: 127 }], nextCursor: null });
  render(<AstroTraining />); fireEvent.click(screen.getByRole('button', { name: 'Consultar exemplos' }));
  await screen.findByText('Consulta indisponível.');
  expect(screen.queryByText(/Nenhum exemplo salvo/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Consultar exemplos' }));
  await screen.findByRole('button', { name: 'Editar viagem 128' });
  fireEvent.click(screen.getByRole('button', { name: 'Ver mais exemplos' }));
  await screen.findByRole('button', { name: 'Editar viagem 127' });
  expect(screen.getByRole('button', { name: 'Editar viagem 128' })).toBeInTheDocument();
  expect(api.list).toHaveBeenLastCalledWith(7);
});
test('conflito preserva edição e reabrir exige confirmação explícita', async () => {
  api.save.mockRejectedValueOnce(new Error('Este exemplo foi editado em outro acesso.'));
  render(<AstroTraining />); await openTrip(); nameExample();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar exemplo' }));
  await screen.findByText('Este exemplo foi editado em outro acesso.');
  fireEvent.click(screen.getByRole('button', { name: 'Reabrir da base' }));
  fireEvent.click(screen.getByRole('button', { name: 'Manter edição' }));
  expect(screen.getByLabelText('Nome do exemplo')).toHaveValue('Circuito de teste');
  expect(api.trip).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Reabrir da base' }));
  fireEvent.click(screen.getByRole('button', { name: 'Substituir rascunho e reabrir' }));
  await waitFor(() => expect(screen.getByLabelText('Nome do exemplo')).toHaveValue(''));
});
test('permite excluir uma NF e recolocar sem perder as demais', async () => {
  render(<AstroTraining />); await openTrip();
  fireEvent.change(screen.getByLabelText('Excluir NF 10001'), { target: { value: 'photo_unknown' } });
  expect(screen.getByText('2 NFs incluídas')).toBeInTheDocument();
  expect(within(screen.getByRole('list', { name: 'Sequência de NFs' })).getAllByRole('listitem')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Recolocar NF 10001' }));
  expect(screen.getByText('3 NFs incluídas')).toBeInTheDocument();
});
test('rascunhos são separados por usuário e empresa; conteúdo inválido não é apagado', () => {
  const key = draftKey(trip); writeDraft(key, initialDraft(trip));
  localStorage.setItem('user_login', 'outro-usuario'); expect(readDraft(draftKey(trip))).toBeNull();
  localStorage.setItem('user_login', 'Rogatti'); localStorage.setItem('company_id', '2'); expect(readDraft(draftKey(trip))).toBeNull();
  localStorage.setItem(key, '{corrompido'); expect(() => readDraft(key)).toThrow('preservado'); expect(localStorage.getItem(key)).toBe('{corrompido');
});
test('rascunho ilegível pode ser substituído só com confirmação e nova consulta', async () => {
  localStorage.setItem(draftKey(trip), '{corrompido'); render(<AstroTraining />);
  fireEvent.change(screen.getByLabelText('ID da viagem'), { target: { value: '128' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar viagem' }));
  await screen.findByText(/O rascunho deste navegador não pôde ser lido/);
  expect(localStorage.getItem(draftKey(trip))).toBe('{corrompido');
  fireEvent.click(screen.getByRole('button', { name: 'Reabrir da base' }));
  fireEvent.click(screen.getByRole('button', { name: 'Substituir rascunho e reabrir' }));
  await screen.findByLabelText('Nome do exemplo'); expect(readDraft(draftKey(trip))).toEqual(initialDraft(trip));
});
test('bloqueia duplo salvamento enquanto aguarda confirmação', async () => {
  let finish!: (value: { accepted: boolean; version: number; exampleId: number }) => void;
  api.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<AstroTraining />); await openTrip(); nameExample();
  const button = screen.getByRole('button', { name: 'Salvar exemplo' }); fireEvent.click(button); fireEvent.click(button);
  expect(api.save).toHaveBeenCalledTimes(1);
  await act(async () => finish({ accepted: true, version: 1, exampleId: 7 }));
  expect(screen.getByText('Exemplo salvo na base · revisão 1')).toBeInTheDocument();
});
test.each(['admin', 'master', 'expedicao'])('acesso de treinamento permitido para %s', permission => expect(canAccessAstroTraining(permission, 'Rogatti', '1')).toBe(true));
test.each(['user', 'conferente', 'control_tower', 'driver', ''])('acesso de treinamento negado para %s', permission => expect(canAccessAstroTraining(permission, 'Rogatti', '1')).toBe(false));

test.each(['admin', 'master', 'expedicao'])('outra conta %s não vê nem abre o treinamento', permission => { expect(canAccessAstroTraining(permission, 'Outro login', '1')).toBe(false); expect(canAccessAstroTraining(permission, 'Rogatti', '2')).toBe(false); });
