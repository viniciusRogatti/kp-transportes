const toPositiveNumber = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const parseKgPerBoxFromDescription = (description?: string | null): number | null => {

  const text = String(description || '').trim().toUpperCase();
  // A multipack explicitly identifies both count and weight per pack.
  const multipack = text.match(/\b(?:CX|CAIXA)\s*(?:C\s*\/|COM|DE)?\s*(\d+(?:[.,]\d+)?)\s*[X×]\s*(\d+(?:[.,]\d+)?)\s*(KG|GR|G)\b/);
  if (multipack) {
    const count = toPositiveNumber(multipack[1]);
    const weight = toPositiveNumber(multipack[2]);
    return count && weight ? count * weight / (multipack[3] === 'KG' ? 1 : 1000) : null;
  }
  const matches = Array.from(text.matchAll(/\b(?:CX|CAIXA)\s*(?:C\s*\/|COM|DE)?\s*(\d+(?:[.,]\d+)?)\s*(KG|QUILOS?|GR|G)\b/g));
  const weights = matches.map(match => {
    const weight = toPositiveNumber(match[1]);
    return weight ? weight / (/^(KG|QUILO)/.test(match[2]) ? 1 : 1000) : null;
  });
  return weights.length && weights.every(weight => weight === weights[0]) ? weights[0] : null;
};

export const parseUnitsPerBoxFromDescription = (description?: string | null) => {
  const normalized = String(description || '').trim().toUpperCase();
  if (!normalized) return null;

  const explicitBoxQuantity = normalized.match(
    /\bCX\s*(?:C\s*\/\s*)?(\d+(?:[.,]\d+)?)\s*(?:UN(?:IDADES?)?|POTES?|BOX(?:ES)?)\b/,
  );
  if (explicitBoxQuantity?.[1]) return toPositiveNumber(explicitBoxQuantity[1]);

  const compactBoxQuantity = normalized.match(
    /\bCX\s*(?:C\s*\/\s*)?(\d+(?:[.,]\d+)?)(?=\s*(?:\*{2,}|$))/,
  );
  if (compactBoxQuantity?.[1]) return toPositiveNumber(compactBoxQuantity[1]);

  const dimensionsQuantity = normalized.match(
    /\b(?:CX\s*)?(\d+(?:[.,]\d+)?)\s*X\s*\d+(?:[.,]\d+)?\s*(?:G|GR|KG|ML|L)\b/,
  );
  if (dimensionsQuantity?.[1]) return toPositiveNumber(dimensionsQuantity[1]);

  return null;
};
