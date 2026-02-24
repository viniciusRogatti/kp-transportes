import { IDanfe } from '../types/types';

const XML_ENTITY_REGEX = /&(#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g;
const XML_ENTITY_FALLBACK_MAP: Record<string, string> = {
  amp: '&',
  apos: '\'',
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

let xmlEntityDecoder: HTMLTextAreaElement | null = null;

function decodeXmlEntitiesOnce(input: string) {
  if (typeof document !== 'undefined') {
    if (!xmlEntityDecoder) {
      xmlEntityDecoder = document.createElement('textarea');
    }
    xmlEntityDecoder.innerHTML = input;
    return xmlEntityDecoder.value;
  }

  return input.replace(XML_ENTITY_REGEX, (fullMatch, entityRaw) => {
    const entity = String(entityRaw || '').trim();
    if (!entity) return fullMatch;

    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCharCode(codePoint) : fullMatch;
    }

    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCharCode(codePoint) : fullMatch;
    }

    const fallback = XML_ENTITY_FALLBACK_MAP[entity.toLowerCase()];
    return fallback ?? fullMatch;
  });
}

export function decodeXmlEntitiesDeep(value: unknown, maxDepth = 4) {
  let current = String(value || '');
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const decoded = decodeXmlEntitiesOnce(current);
    if (decoded === current) break;
    current = decoded;
  }
  return current;
}

export function normalizeTextValue(value: unknown) {
  return decodeXmlEntitiesDeep(String(value || '').trim());
}

export function normalizeCityLabel(value: unknown) {
  return normalizeTextValue(value);
}

function toNullableText(value: unknown) {
  const normalized = normalizeTextValue(value);
  return normalized || null;
}

export function sanitizeDanfeTextFields(danfe: IDanfe): IDanfe {
  return {
    ...danfe,
    Customer: {
      ...danfe.Customer,
      name_or_legal_entity: normalizeTextValue(danfe.Customer?.name_or_legal_entity),
      city: normalizeCityLabel(danfe.Customer?.city) || '',
      phone: toNullableText(danfe.Customer?.phone),
      address: toNullableText(danfe.Customer?.address),
      address_number: toNullableText(danfe.Customer?.address_number),
      neighborhood: toNullableText(danfe.Customer?.neighborhood),
      state: toNullableText(danfe.Customer?.state),
      zip_code: toNullableText(danfe.Customer?.zip_code),
      cnpj_or_cpf: normalizeTextValue(danfe.Customer?.cnpj_or_cpf),
    },
    DanfeProducts: Array.isArray(danfe.DanfeProducts)
      ? danfe.DanfeProducts.map((product) => ({
        ...product,
        type: normalizeTextValue(product.type),
        Product: {
          ...product.Product,
          code: normalizeTextValue(product.Product?.code),
          description: normalizeTextValue(product.Product?.description),
          type: normalizeTextValue(product.Product?.type),
        },
      }))
      : danfe.DanfeProducts,
  };
}
