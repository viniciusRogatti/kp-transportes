import { formatDateBR } from '../../utils/dateDisplay';

export const numberFmt = new Intl.NumberFormat('pt-BR');
export const decimalFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCompactDate(dateIso: string) {
  return formatDateBR(dateIso);
}

export function formatDateTime(dateIso: string) {
  return formatDateBR(dateIso);
}
