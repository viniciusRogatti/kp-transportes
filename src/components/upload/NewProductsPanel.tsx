import { IImportedProduct } from '../../types/upload';

interface NewProductsPanelProps {
  newProducts: IImportedProduct[];
  updatedProducts: IImportedProduct[];
}

const formatMoney = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
}).format(Number(value || 0));

function ProductRows({
  title,
  products,
  badgeLabel,
  badgeClassName,
}: {
  title: string;
  products: IImportedProduct[];
  badgeLabel: string;
  badgeClassName: string;
}) {
  if (!products.length) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-text">{title}</h4>
      <div className="space-y-2">
        {products.map((product) => (
          <div key={`${badgeLabel}-${product.code}-${product.sourceFile}`} className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-text">
                {product.code} - {product.description}
              </p>
              <span className={`inline-flex h-7 items-center rounded-full border px-2 text-[0.66rem] font-semibold uppercase tracking-wide ${badgeClassName}`}>
                {badgeLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Preço: {formatMoney(product.price)} • Origem: {product.sourceFile}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewProductsPanel({ newProducts, updatedProducts }: NewProductsPanelProps) {
  if (!newProducts.length && !updatedProducts.length) {
    return (
      <div className="rounded-xl border border-border bg-surface/80 p-4 text-sm text-muted">
        Nenhum produto novo/atualizado neste processamento.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProductRows
        title="Novos produtos cadastrados"
        products={newProducts}
        badgeLabel="Novo"
        badgeClassName="border-emerald-500/45 bg-emerald-500/15 text-[color:var(--color-success)]"
      />
      <ProductRows
        title="Produtos atualizados"
        products={updatedProducts}
        badgeLabel="Atualizado"
        badgeClassName="border-amber-500/45 bg-amber-500/15 text-[color:var(--color-warning)]"
      />
    </div>
  );
}

export default NewProductsPanel;
