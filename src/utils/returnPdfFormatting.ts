export const formatReturnQuantity = (value: number | string | null | undefined) => {
  const quantity = Number(value || 0);
  if (!Number.isFinite(quantity)) return '0';

  const rounded = Math.round((quantity + Number.EPSILON) * 1000) / 1000;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(rounded);
};
