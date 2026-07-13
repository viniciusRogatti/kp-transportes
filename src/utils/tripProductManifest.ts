import { IDanfe, ITripNote } from '../types/types';
import { groupTripProductsByCodeAndUnit, TripProductRow } from './tripProducts';

export type SalmonSeparationRow = {
  customerName: string;
  code: string;
  description: string;
  type: string;
  quantity: number;
  invoiceNumbers: string[];
};

export type ProntoBoxRow = {
  invoiceNumber: string;
  customerName: string;
  boxQuantity: number | null;
};

export type TripProductManifest = {
  products: TripProductRow[];
  salmonSeparations: SalmonSeparationRow[];
  prontoBoxes: ProntoBoxRow[];
};

const normalizeSearchText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

const routeKey = (companyId: unknown, invoiceNumber: unknown) => (
  `${Number(companyId || 0)}::${String(invoiceNumber || '').trim()}`
);

export const isVariableWeightSalmon = (description: unknown, unit: unknown) => {
  if (normalizeSearchText(unit) !== 'KG') return false;
  const normalizedDescription = normalizeSearchText(description);
  return normalizedDescription.startsWith('SALMAO ')
    || normalizedDescription.includes('FILE DE SALMAO');
};

export function buildTripProductManifest(
  tripNotes: ITripNote[] = [],
  danfes: IDanfe[] = [],
): TripProductManifest {
  const danfeByRouteKey = new Map(
    danfes.map((danfe) => [routeKey(danfe.company_id, danfe.invoice_number), danfe]),
  );
  const standardProducts: TripProductRow[] = [];
  const salmonByCustomerAndProduct = new Map<string, SalmonSeparationRow>();
  const prontoBoxes: ProntoBoxRow[] = [];

  tripNotes.forEach((note) => {
    const invoiceNumber = String(note.invoice_number || '').trim();
    const danfe = danfeByRouteKey.get(routeKey(note.company_id, invoiceNumber));
    const companyCode = normalizeSearchText(danfe?.company?.code);
    const customerName = String(
      danfe?.Customer?.name_or_legal_entity || note.customer_name || 'Cliente nao identificado',
    ).trim();

    if (companyCode === 'PRONTO') {
      prontoBoxes.push({
        invoiceNumber,
        customerName,
        boxQuantity: Number(note.box_quantity || 0) || null,
      });
      return;
    }

    const sourceProducts = danfe?.DanfeProducts?.length
      ? danfe.DanfeProducts
      : (note.products || []);

    sourceProducts.forEach((product) => {
      const nestedProduct = 'Product' in product ? product.Product : undefined;
      const directProduct = 'code' in product ? product : undefined;
      const code = String(nestedProduct?.code || directProduct?.code || '').trim();
      const description = String(nestedProduct?.description || directProduct?.description || '').trim();
      const type = String(product?.type || nestedProduct?.type || '').trim().toUpperCase();
      const quantity = Number(product?.quantity || 0);

      if (!isVariableWeightSalmon(description, type)) {
        standardProducts.push({
          company_id: Number(note.company_id || danfe?.company_id || 0) || null,
          code,
          description,
          type,
          quantity,
        });
        return;
      }

      const customerKey = normalizeSearchText(danfe?.customer_id || note.customer_id || customerName);
      const groupingKey = `${customerKey}::${code}::${type}`;
      const existing = salmonByCustomerAndProduct.get(groupingKey);
      if (existing) {
        existing.quantity += quantity;
        if (invoiceNumber && !existing.invoiceNumbers.includes(invoiceNumber)) {
          existing.invoiceNumbers.push(invoiceNumber);
        }
        return;
      }

      salmonByCustomerAndProduct.set(groupingKey, {
        customerName,
        code,
        description,
        type,
        quantity,
        invoiceNumbers: invoiceNumber ? [invoiceNumber] : [],
      });
    });
  });

  return {
    products: groupTripProductsByCodeAndUnit(standardProducts),
    salmonSeparations: Array.from(salmonByCustomerAndProduct.values())
      .sort((left, right) => left.customerName.localeCompare(right.customerName, 'pt-BR')),
    prontoBoxes: prontoBoxes.sort((left, right) => left.invoiceNumber.localeCompare(right.invoiceNumber, 'pt-BR', { numeric: true })),
  };
}
