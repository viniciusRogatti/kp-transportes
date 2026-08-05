const ISO_DATE_PREFIX_REGEX = /^(\d{4})-(\d{2})-(\d{2})/;
const BR_DATE_REGEX = /^(\d{2})[/-](\d{2})[/-](\d{4})$/;
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

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

export function normalizeDateForApi(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const isoMatch = normalized.match(ISO_DATE_REGEX);
  const brMatch = normalized.match(BR_DATE_REGEX);
  const parts = isoMatch
    ? { year: isoMatch[1], month: isoMatch[2], day: isoMatch[3] }
    : brMatch
      ? { year: brMatch[3], month: brMatch[2], day: brMatch[1] }
      : null;
  if (!parts) return null;

  const parsed = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  if (
    parsed.getUTCFullYear() !== Number(parts.year)
    || parsed.getUTCMonth() !== Number(parts.month) - 1
    || parsed.getUTCDate() !== Number(parts.day)
  ) return null;

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatDateTimeBR(value: unknown, fallback = '-') {
  if (!value) return fallback;
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}
