import { IDanfe, ITripNote } from '../types/types';

export type TripProductRow = {
  company_id?: number | null;
  code?: string;
  description?: string;
  type?: string;
  quantity: number;
};

export function groupTripProductsByCodeAndUnit(products: TripProductRow[] = []) {
  const grouped = new Map<string, TripProductRow>();

  products.forEach((product) => {
    const companyId = Number(product?.company_id || 0) || 0;
    const code = String(product?.code || '').trim();
    const unit = String(product?.type || '').trim().toUpperCase();
    const quantity = Number(product?.quantity || 0);
    const key = `${companyId}::${code}::${unit}`;
    const existingProduct = grouped.get(key);

    if (existingProduct) {
      existingProduct.quantity += quantity;
      return;
    }

    grouped.set(key, {
      company_id: companyId || null,
      code,
      description: String(product?.description || '').trim(),
      type: unit || '',
      quantity,
    });
  });

  return Array.from(grouped.values());
}

function normalizeTripProductRow(product: {
  company_id?: number | null;
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
    company_id: Number(product?.company_id || 0) || null,
    code: String(product?.Product?.code || product?.code || '').trim(),
    description: String(product?.Product?.description || product?.description || '').trim(),
    type: String(product?.type || product?.Product?.type || '').trim().toUpperCase(),
    quantity: Number(product?.quantity || 0),
  };
}

export function collectTripProductsByNote(tripNotes: ITripNote[] = [], danfes: IDanfe[] = []): TripProductRow[] {
  const danfeByInvoice = new Map(
    danfes.map((danfe) => [`${Number(danfe.company_id || 0)}::${String(danfe.invoice_number || '').trim()}`, danfe]),
  );

  return tripNotes.flatMap((note) => {
    const invoiceNumber = String(note.invoice_number || '').trim();
    const companyId = Number(note.company_id || 0);
    const danfeProducts = danfeByInvoice.get(`${companyId}::${invoiceNumber}`)?.DanfeProducts || [];
    if (danfeProducts.length > 0) return danfeProducts.map(normalizeTripProductRow);
    return Array.isArray(note.products)
      ? note.products.map((product) => normalizeTripProductRow({ ...product, company_id: companyId || null }))
      : [];
  });
}
