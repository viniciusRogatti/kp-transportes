import { act, renderHook } from '@testing-library/react';
import axios from 'axios';
import useInvoiceSearchContext from '../useInvoiceSearchContext';
import { IDanfe } from '../../types/types';
import { API_READ_TIMEOUT_MS } from '../../utils/apiReadTimeout';

jest.mock('axios');

it('limita a consulta POST de leitura e libera carregamento com erro por empresa/NF', async () => {
  (axios.post as jest.Mock).mockRejectedValue(new Error('timeout'));
  const { result } = renderHook(() => useInvoiceSearchContext());
  const rows = [1, 2, 3].map((company_id) => ({ company_id, invoice_number: '123' } as IDanfe));
  await act(async () => { await result.current.loadInvoiceContext(rows); });
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/danfes\/search-context$/), {
    invoices: rows,
  }, { timeout: API_READ_TIMEOUT_MS });
  expect(Object.values(result.current.driverLoadingByInvoice)).toEqual([false, false, false]);
  expect(Object.values(result.current.driverErrorByInvoice)).toEqual([true, true, true]);
  expect(result.current.invoiceContextByNf).toEqual({});
});
