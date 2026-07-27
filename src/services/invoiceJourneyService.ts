import axios from 'axios';
import { API_URL } from '../data';
import { IInvoiceJourney } from '../types/types';

export async function getInvoiceJourney(invoiceNumber: string, companyId?: number | null) {
  const { data } = await axios.get<IInvoiceJourney>(
    `${API_URL}/danfes/nf/${encodeURIComponent(invoiceNumber)}/journey`,
    { params: companyId ? { companyId } : undefined },
  );
  return data;
}
