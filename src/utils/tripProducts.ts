import { IDanfe, ITripNote } from '../types/types';

export type TripProductRow = {
  code?: string;
  description?: string;
  type?: string | null;
  quantity: number;
};

export function groupTripProductsByCodeAndUnit(products: TripProductRow[] = []) {
  return products.reduce<TripProductRow[]>((accumulator, product) => {
    const code = String(product?.code || '').trim();
    const unit = String(product?.type || '').trim().toUpperCase();
    const existingProduct = accumulator.find((item) => {
      const existingCode = String(item?.code || '').trim();
      const existingUnit = String(item?.type || '').trim().toUpperCase();
      return existingCode === code && existingUnit === unit;
    });
    const quantity = Number(product?.quantity || 0);

    if (existingProduct) {
      existingProduct.quantity += quantity;
      return accumulator;
    }

    accumulator.push({
      code,
      description: String(product?.description || '').trim(),
      type: unit || null,
      quantity,
    });

    return accumulator;
  }, []);
}

function normalizeTripProductRow(product: {
  Product?: {
    code?: string;
    description?: string;
    type?: string | null;
  };
  code?: string;
  description?: string;
  type?: string | null;
  quantity?: number | string;
}): TripProductRow {
  return {
    code: String(product?.Product?.code || product?.code || '').trim(),
    description: String(product?.Product?.description || product?.description || '').trim(),
    type: String(product?.type || product?.Product?.type || '').trim().toUpperCase() || null,
    quantity: Number(product?.quantity || 0),
  };
}

export function collectTripProductsByNote(tripNotes: ITripNote[] = [], danfes: IDanfe[] = []): TripProductRow[] {
  const danfeByInvoice = new Map(
    danfes.map((danfe) => [String(danfe.invoice_number || '').trim(), danfe]),
  );

  return tripNotes.flatMap((note) => {
    const invoiceNumber = String(note.invoice_number || '').trim();
    const danfeProducts = danfeByInvoice.get(invoiceNumber)?.DanfeProducts || [];
    if (danfeProducts.length > 0) return danfeProducts.map(normalizeTripProductRow);
    return Array.isArray(note.products) ? note.products.map(normalizeTripProductRow) : [];
  });
}
