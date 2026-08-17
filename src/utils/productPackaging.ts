const toPositiveNumber = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
