import { useEffect, useState } from 'react';
import { IDanfe, IInvoiceSearchContext } from '../types/types'
import { CardsDanfe, ContainerCards, ContainerItems, DescriptionColumns, ItemsScrollArea, ListItems, TitleCard, TotalQuantity } from '../style/CardDanfes';
import { formatDateBR } from '../utils/dateDisplay';
import { normalizeCityLabel, normalizeTextValue } from '../utils/textNormalization';

interface CardDanfesProps {
  danfes: IDanfe[];
  animationKey?: string;
  driverByInvoice?: Record<string, string>;
  invoiceContextByNf?: Record<string, IInvoiceSearchContext>;
}

const RETURN_TYPE_LABELS: Record<string, string> = {
  total: 'Devolucao total',
  partial: 'Devolucao parcial',
  sobra: 'Sobra',
  coleta: 'Coleta',
};

function CardDanfes({
  danfes,
  animationKey,
  driverByInvoice = {},
  invoiceContextByNf = {},
} : CardDanfesProps) {
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [productsModalDanfe, setProductsModalDanfe] = useState<IDanfe | null>(null);

  const formatQuantity = (quantity: number | string, unit: string) => {
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed)) {
      return `${String(quantity)} ${unit}`;
    }

    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    }).format(parsed);

    return `${formatted} ${unit}`;
  };

  function toggleFlip(key: string) {
    setFlippedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openProductsModal(danfe: IDanfe) {
    setProductsModalDanfe(danfe);
  }

  function closeProductsModal() {
    setProductsModalDanfe(null);
  }

  useEffect(() => {
    if (!productsModalDanfe) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProductsModalDanfe(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [productsModalDanfe]);

  return (
    <>
      <ContainerCards key={animationKey}>
        { danfes.map((danfe) => {
          const key = String(danfe.barcode || danfe.invoice_number);
          const isFlipped = Boolean(flippedCards[key]);
          const driverName = driverByInvoice[String(danfe.invoice_number)];
          const invoiceContext = invoiceContextByNf[String(danfe.invoice_number)] || null;
          const customerName = normalizeTextValue(danfe.Customer?.name_or_legal_entity) || '-';
          const cityName = normalizeCityLabel(danfe.Customer?.city) || '-';
          const customerAddress = normalizeTextValue(danfe.Customer?.address) || '-';
          const returnTypeLabels = invoiceContext?.return_types?.length
            ? invoiceContext.return_types.map((type) => RETURN_TYPE_LABELS[type] || type)
            : [];

          return (
            <div key={key} className="h-[350px] w-full max-w-[360px] [perspective:1200px]">
              <div
                className="relative h-full w-full transition-transform duration-500"
                style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'none' }}
              >
                <CardsDanfe
                  className={!driverName ? 'absolute inset-0 select-text overflow-hidden border-accent/55 shadow-[0_0_0_1px_rgba(1,87,163,0.25)]' : 'absolute inset-0 select-text overflow-hidden'}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <TitleCard>
                    <h1>{`NF ${danfe.invoice_number}`}</h1>
                    <p className={`absolute left-1/2 top-1.5 -translate-x-1/2 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      driverName
                        ? 'border-emerald-500/40 bg-emerald-900/25 text-emerald-200'
                        : 'border-accent/45 bg-accent/20 text-text-accent'
                    }`}>
                      {driverName ? `Motorista: ${driverName}` : 'Sem motorista'}
                    </p>
                    <h4>{formatDateBR(danfe.invoice_date)}</h4>
                  </TitleCard>
                  <h4 className="mt-1 text-sm font-semibold leading-tight">{customerName}</h4>
                  <p className="text-xs text-muted">{cityName}</p>
                  {invoiceContext && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {invoiceContext.occurrence_count > 0 && (
                        <span className="rounded-full border border-amber-400/45 bg-amber-900/25 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                          {`Ocorrencias: ${invoiceContext.occurrence_count}`}
                        </span>
                      )}
                      {invoiceContext.credit_letter_count > 0 && (
                        <span className="rounded-full border border-sky-400/45 bg-sky-900/25 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                          {`Carta de credito: ${invoiceContext.credit_letter_pending_count > 0 ? 'pendente' : 'concluida'}`}
                        </span>
                      )}
                      {returnTypeLabels.map((label) => (
                        <span
                          key={`${danfe.invoice_number}-return-type-${label}`}
                          className="rounded-full border border-emerald-400/45 bg-emerald-900/25 px-2 py-0.5 text-[10px] font-semibold text-emerald-200"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                  <ContainerItems>
                    {danfe.DanfeProducts.length > 4 && (
                      <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-surface-2/85 px-2 py-1">
                        <p className="text-[10px] font-medium text-muted">
                          Lista grande de itens.
                        </p>
                        <button
                          type="button"
                          onClick={() => openProductsModal(danfe)}
                          className="inline-flex h-6 shrink-0 items-center rounded-md border border-accent/45 bg-accent/15 px-2 text-[10px] font-semibold text-text-accent transition hover:bg-accent/25"
                          aria-label={`Abrir lista completa de produtos da NF ${danfe.invoice_number}`}
                        >
                          Ver todos
                        </button>
                      </div>
                    )}
                    <DescriptionColumns className="shrink-0 pr-1">
                      <span>Código</span>
                      <span>Descrição</span>
                      <span>Qtd</span>
                    </DescriptionColumns>
                    <ItemsScrollArea aria-label={`Itens da NF ${danfe.invoice_number}`}>
                      {danfe.DanfeProducts.map((item) => (
                        <ListItems key={ `${danfe.invoice_number}-${item.Product.code}` }>
                            <li>{item.Product.code}</li>
                            <li title={normalizeTextValue(item.Product.description)}>{normalizeTextValue(item.Product.description)}</li>
                            <li>{formatQuantity(item.quantity, item.type)}</li>
                        </ListItems>
                      ))}
                    </ItemsScrollArea>
                  </ContainerItems>
                  <TotalQuantity className="mt-auto flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate">{`Quantidade Total: ${formatQuantity(danfe.total_quantity, 'UN')}`}</p>
                    <button
                      type="button"
                      onClick={() => toggleFlip(key)}
                      className="inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-surface-2/85 px-2 text-[11px] font-semibold text-text transition hover:border-accent/60 hover:text-text-accent"
                      aria-label={`Mostrar detalhes da NF ${danfe.invoice_number}`}
                    >
                      Detalhes
                    </button>
                  </TotalQuantity>
                </CardsDanfe>

                <CardsDanfe
                  className="absolute inset-0 select-text overflow-hidden"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <TitleCard>
                    <h1>{`NF ${danfe.invoice_number}`}</h1>
                    <h4>Detalhes</h4>
                  </TitleCard>
                  <div className="mt-2 space-y-2 text-sm">
                    <p><strong>Cliente:</strong> {customerName}</p>
                    <p><strong>Endereço:</strong> {customerAddress}</p>
                    <p><strong>Cidade:</strong> {cityName}</p>
                    <p><strong>Telefone:</strong> {normalizeTextValue(danfe.Customer.phone) || '-'}</p>
                    <p><strong>Carga:</strong> {danfe.load_number || '-'}</p>
                    <p><strong>Motorista:</strong> {driverName || 'Sem motorista'}</p>
                    {invoiceContext ? (
                      <>
                        <p>
                          <strong>Ocorrencias:</strong>
                          {` ${invoiceContext.occurrence_count} (pendentes: ${invoiceContext.occurrence_pending_count} | resolvidas: ${invoiceContext.occurrence_resolved_count})`}
                        </p>
                        <p>
                          <strong>Carta de credito:</strong>
                          {` ${invoiceContext.credit_letter_count ? `${invoiceContext.credit_letter_pending_count} pendente(s) / ${invoiceContext.credit_letter_completed_count} concluida(s)` : 'nenhuma'}`}
                        </p>
                        <p>
                          <strong>Devolucoes:</strong>
                          {` ${returnTypeLabels.length ? returnTypeLabels.join(', ') : 'nenhuma'}`}
                        </p>
                      </>
                    ) : (
                      <p><strong>Eventos:</strong> sem ocorrencia/devolucao registrada para esta NF.</p>
                    )}
                  </div>
                  <TotalQuantity className="mt-auto flex items-center justify-between gap-2">
                    <p>Use o botão Voltar</p>
                    <button
                      type="button"
                      onClick={() => toggleFlip(key)}
                      className="inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-surface-2/85 px-2 text-[11px] font-semibold text-text transition hover:border-accent/60 hover:text-text-accent"
                      aria-label={`Voltar para frente do card da NF ${danfe.invoice_number}`}
                    >
                      Voltar
                    </button>
                  </TotalQuantity>
                </CardsDanfe>
              </div>
            </div>
          );
        })}
      </ContainerCards>

      {productsModalDanfe ? (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center p-3">
          <button
            type="button"
            aria-label="Fechar lista de produtos"
            className="absolute inset-0 bg-slate-950/80"
            onClick={closeProductsModal}
          />
          <div className="relative z-[1410] flex w-full max-w-[680px] max-h-[88vh] flex-col rounded-lg border border-border bg-card p-3 text-text shadow-[0_14px_34px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">{`NF ${productsModalDanfe.invoice_number}`}</h3>
                <p className="text-xs text-muted">
                  {`${normalizeTextValue(productsModalDanfe.Customer?.name_or_legal_entity) || '-'} | ${normalizeCityLabel(productsModalDanfe.Customer?.city) || '-'}`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeProductsModal}
                className="inline-flex h-8 items-center rounded-md border border-border bg-surface-2/85 px-2 text-xs font-semibold text-text transition hover:border-accent/60 hover:text-text-accent"
              >
                Fechar
              </button>
            </div>

            <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-surface-2/65 p-2">
              <DescriptionColumns className="shrink-0 pr-1">
                <span>Código</span>
                <span>Descrição</span>
                <span>Qtd</span>
              </DescriptionColumns>
              <div className="scrollbar-ui mt-1 min-h-0 flex-1 overflow-y-auto pr-1">
                {productsModalDanfe.DanfeProducts.map((item) => (
                  <ListItems key={`modal-${productsModalDanfe.invoice_number}-${item.Product.code}`}>
                    <li>{item.Product.code}</li>
                    <li title={normalizeTextValue(item.Product.description)}>{normalizeTextValue(item.Product.description)}</li>
                    <li>{formatQuantity(item.quantity, item.type)}</li>
                  </ListItems>
                ))}
              </div>
            </div>

            <p className="mt-2 text-xs font-medium text-muted">
              {`Total de itens: ${productsModalDanfe.DanfeProducts.length}`}
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default CardDanfes;
