import { IDanfe, IDanfeProduct, IGroupedProduct } from '../types/types';

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
  const allProducts = danfes.flatMap((danfe) => danfe.DanfeProducts || []);
  const groupedProductsMap = new Map<string, IGroupedProduct>();

  allProducts.forEach((product: IDanfeProduct) => {
    const productCode = String(product.Product?.code || '').trim();
    const quantity = normalizeGroupedProductQuantity(Number(product.quantity || 0));
    const existingProduct = groupedProductsMap.get(productCode);

    if (existingProduct) {
      existingProduct.quantity = normalizeGroupedProductQuantity(existingProduct.quantity + quantity);
      return;
    }

    groupedProductsMap.set(productCode, {
      quantity,
      Product: product.Product,
    });
  });

  return Array.from(groupedProductsMap.values()).sort((productA, productB) => (
    String(productA.Product?.description || '').localeCompare(
      String(productB.Product?.description || ''),
      'pt-BR',
      { sensitivity: 'base' },
    )
  ));
}
