export const numberFmt = new Intl.NumberFormat('pt-BR');
export const decimalFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCompactDate(dateIso: string) {
  const date = new Date(dateIso);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatDateTime(dateIso: string) {
  const date = new Date(dateIso);
  return date.toLocaleString('pt-BR');
}
