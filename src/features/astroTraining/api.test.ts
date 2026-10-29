import axios from 'axios';
import { trainingApi } from './api';

jest.mock('axios');
const api = axios as jest.Mocked<typeof axios>;
test('normaliza IDs numéricos da API e exemplos antigos sem separação', async () => {
  api.get.mockResolvedValueOnce({ data: { trip: { id: 9 }, sourceRevision: 'r', stops: [{ id: 12, key: 'c', companyId: 2 }], example: { snapshot: { stopIds: [12], exclusions: [] } } } });
  const data = await trainingApi.trip('9');
  expect(api.get).toHaveBeenCalledWith(expect.stringMatching(/\/astro-training\/trips\/9$/));
  expect(data.stops[0].id).toBe('12'); expect(data.stops[0].companyId).toBe(2);
  expect(data.example?.snapshot.separatedStopIds).toEqual([]);
});
test('HTTP 200 sem confirmação não vira sucesso e o PUT tem tempo limite', async () => {
  api.put.mockResolvedValueOnce({ data: { accepted: false } });
  const payload = { clientEventId: 'test-request', expectedVersion: 0, sourceRevision: 'r', routeName: 'Teste', stopIds: [12], separatedStopIds: [], exclusions: [], note: '' };
  await expect(trainingApi.save(9, payload)).rejects.toThrow('não confirmou');
  expect(api.put).toHaveBeenCalledWith(expect.stringMatching(/\/astro-training\/trips\/9\/example$/), payload, { timeout: 20000 });
});
