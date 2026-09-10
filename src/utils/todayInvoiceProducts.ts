import { IDanfe, IGroupedProduct } from '../types/types';

const GROUPED_PRODUCT_QUANTITY_PRECISION = 1000;

function normalizeGroupedProductQuantity(value: number) {
  return Math.round(value * GROUPED_PRODUCT_QUANTITY_PRECISION) / GROUPED_PRODUCT_QUANTITY_PRECISION;
}

export function formatGroupedProductQuantity(quantity: number | string) {
  const parsed = Number(quantity);
  if (!Number.isFinite(parsed)) {
    return String(quantity);
  }

  const normalizedQuantity = normalizeGroupedProductQuantity(parsed);
  return Number.isInteger(normalizedQuantity)
    ? String(normalizedQuantity)
    : normalizedQuantity.toFixed(3).replace(/\.?0+$/, '');
}

export function groupTodayInvoiceProducts(danfes: IDanfe[]): IGroupedProduct[] {
  const allProducts = danfes.flatMap((danfe) => (danfe.DanfeProducts || []).map((product) => ({ product, companyId: product.company_id || danfe.company_id, company: danfe.company })));
  const groupedProductsMap = new Map<string, IGroupedProduct>();

  allProducts.forEach(({ product, companyId, company }) => {
    const productCode = String(product.Product?.code || '').trim();
    const key = `${companyId || 0}::${productCode}::${product.Product?.type || product.type}`;
    const quantity = Number(product.quantity || 0);
    const existingProduct = groupedProductsMap.get(key);

    if (existingProduct) {
      existingProduct.quantity += quantity;
      return;
    }

    groupedProductsMap.set(key, {
      quantity,
      Product: { ...product.Product, company_id: companyId,
        company: companyId && company ? { id: companyId, code: company.code, name: company.name } : undefined },
    });
  });

  return Array.from(groupedProductsMap.values()).map((product) => ({ ...product, quantity: normalizeGroupedProductQuantity(product.quantity) })).sort((productA, productB) => (
    String(productA.Product?.description || '').localeCompare(
      String(productB.Product?.description || ''),
      'pt-BR',
      { sensitivity: 'base' },
    )
  ));
}
