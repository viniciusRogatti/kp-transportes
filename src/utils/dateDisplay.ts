const ISO_DATE_PREFIX_REGEX = /^(\d{4})-(\d{2})-(\d{2})/;
const BR_DATE_REGEX = /^(\d{2})[/-](\d{2})[/-](\d{4})$/;

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

export function formatDateBR(value: unknown, fallback = '-') {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallback;
    return value.toLocaleDateString('pt-BR');
  }

  const normalized = normalizeText(value);
  if (!normalized) return fallback;

  const brDateMatch = normalized.match(BR_DATE_REGEX);
  if (brDateMatch) {
    const [, day, month, year] = brDateMatch;
    return `${day}/${month}/${year}`;
  }

  const isoDateMatch = normalized.match(ISO_DATE_PREFIX_REGEX);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;
  return parsed.toLocaleDateString('pt-BR');
}
