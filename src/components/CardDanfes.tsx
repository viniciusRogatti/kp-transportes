import { memo, useEffect, useMemo, useState } from 'react';
import Badge from './ui/Badge';
import { cn } from '../lib/cn';
import { IDanfe, IInvoiceSearchContext } from '../types/types';
import { CardsDanfe, ContainerCards, ContainerItems, DescriptionColumns, ItemsScrollArea, ListItems, TitleCard, TotalQuantity } from '../style/CardDanfes';
import { formatDateBR } from '../utils/dateDisplay';
import {
  DANFE_STATUS_LEGEND,
  DanfeLegendKey,
  getDanfeLegendItem,
  getOccurrenceTone,
  getOperationalStatusCardClassName,
  getOperationalStatusLabel,
  getOperationalStatusTone,
  getSemanticToneClassName,
  matchesDanfeLegendFilter,
} from '../utils/statusStyles';
import { normalizeCityLabel, normalizeTextValue } from '../utils/textNormalization';

interface CardDanfesProps {
  danfes: IDanfe[];
  driverByInvoice?: Record<string, string>;
  invoiceContextByNf?: Record<string, IInvoiceSearchContext>;
  showLegend?: boolean;
}

const RETURN_TYPE_LABELS: Record<string, string> = {
  total: 'Devolucao total',
  partial: 'Devolucao parcial',
  sobra: 'Sobra',
  coleta: 'Coleta',
};

function getOccurrenceStatusLabel(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'resolved'
    ? 'Ocorrencia resolvida'
    : 'Ocorrencia pendente';
}

function getOccurrenceDetailStatusLabel(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'resolved' ? 'Resolvida' : 'Pendente';
}

function CardDanfes({
  danfes,
  driverByInvoice = {},
  invoiceContextByNf = {},
  showLegend = true,
}: CardDanfesProps) {
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [productsModalDanfe, setProductsModalDanfe] = useState<IDanfe | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<DanfeLegendKey | null>(null);

  const filteredDanfes = useMemo(() => {
    if (!activeStatusFilter) return danfes;
    return danfes.filter((danfe) => matchesDanfeLegendFilter(danfe.status, activeStatusFilter));
  }, [activeStatusFilter, danfes]);

  const activeLegendItem = activeStatusFilter ? getDanfeLegendItem(activeStatusFilter) : null;

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
      {showLegend && danfes.length ? (
        <div className="mx-auto mb-s3 w-full max-w-[1200px] rounded-lg border border-border bg-surface/90 p-s3" data-testid="danfe-status-legend">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Legenda das bordas
            </p>
            {DANFE_STATUS_LEGEND.map((item) => {
              const isActive = activeStatusFilter === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveStatusFilter((current) => (current === item.key ? null : item.key))}
                  aria-label={`Filtrar por ${item.label}`}
                  aria-pressed={isActive}
                  title={item.description}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition hover:brightness-95',
                    isActive ? getSemanticToneClassName(item.tone) : 'semantic-solid-neutral',
                  )}
                >
                  <span className={cn('h-2.5 w-2.5 rounded-full border-2 bg-card', item.borderClassName)} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
            {activeLegendItem ? (
              <button
                type="button"
                onClick={() => setActiveStatusFilter(null)}
                aria-label="Limpar filtro de status"
                className="inline-flex items-center gap-2 rounded-full border semantic-solid-neutral px-2.5 py-1 text-[11px] font-semibold transition hover:brightness-95"
              >
                Fechar filtro
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
          </div>
          {activeLegendItem ? (
            <p className="mt-2 text-xs text-muted">
              {`Filtro ativo: ${activeLegendItem.label}. Exibindo ${filteredDanfes.length} de ${danfes.length} NF(s).`}
            </p>
          ) : null}
        </div>
      ) : null}

      {filteredDanfes.length ? (
        <ContainerCards>
          {filteredDanfes.map((danfe) => {
            const key = String(danfe.barcode || danfe.invoice_number);
            const isFlipped = Boolean(flippedCards[key]);
            const invoiceNumber = String(danfe.invoice_number);
            const invoiceContext = invoiceContextByNf[invoiceNumber] || null;
            const resolvedDriverName = driverByInvoice[invoiceNumber] || invoiceContext?.driver_name || null;
            const customerName = normalizeTextValue(danfe.Customer?.name_or_legal_entity) || '-';
            const cityName = normalizeCityLabel(danfe.Customer?.city) || '-';
            const customerAddress = normalizeTextValue(danfe.Customer?.address) || '-';
            const returnTypeLabels = invoiceContext?.return_types?.length
              ? invoiceContext.return_types.map((type) => RETURN_TYPE_LABELS[type] || type)
              : [];
            const danfeStatusLabel = getOperationalStatusLabel(danfe.status);
            const danfeStatusTone = getOperationalStatusTone(danfe.status);
            const latestOccurrence = invoiceContext?.latest_occurrence || null;
            const latestOccurrenceDescription = normalizeTextValue(latestOccurrence?.description) || 'Ocorrencia registrada para esta NF';
            const latestOccurrenceTone = latestOccurrence ? getOccurrenceTone(latestOccurrence.status) : 'warning';
            const creditLetterTone = invoiceContext?.credit_letter_pending_count ? 'warning' : 'success';
            const driverTone = resolvedDriverName ? 'success' : 'warning';

            return (
              <div key={key} className="h-[350px] w-full max-w-[360px] [perspective:1200px]">
                <div
                  className="relative h-full w-full transition-transform duration-500"
                  style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'none' }}
                >
                  <CardsDanfe
                    data-testid={`danfe-card-${invoiceNumber}`}
                    className={cn(
                      'absolute inset-0 select-text overflow-hidden',
                      getOperationalStatusCardClassName(danfe.status),
                    )}
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <TitleCard className="shrink-0">
                      <h1>{`NF ${danfe.invoice_number}`}</h1>
                      <Badge
                        tone={driverTone}
                        className="absolute left-1/2 top-1.5 h-auto -translate-x-1/2 px-2 py-0.5 text-[10px] leading-tight"
                      >
                        {resolvedDriverName ? `Motorista: ${resolvedDriverName}` : 'Sem motorista'}
                      </Badge>
                      <h4>{formatDateBR(danfe.invoice_date)}</h4>
                    </TitleCard>
                    <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
                      <div className="mt-1 shrink-0">
                        <h4 className="break-words text-sm font-semibold leading-tight">{customerName}</h4>
                        <p className="break-words text-xs text-muted">{cityName}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone={danfeStatusTone} className="h-auto px-2 py-0.5 text-[10px] leading-tight">
                            {danfeStatusLabel}
                          </Badge>
                          {invoiceContext?.occurrence_count ? (
                            <Badge tone="warning" className="h-auto px-2 py-0.5 text-[10px] leading-tight">
                              {`Ocorrencias: ${invoiceContext.occurrence_count}`}
                            </Badge>
                          ) : null}
                          {invoiceContext?.credit_letter_count ? (
                            <Badge tone={creditLetterTone} className="h-auto px-2 py-0.5 text-[10px] leading-tight">
                              {`Carta de credito: ${invoiceContext.credit_letter_pending_count > 0 ? 'pendente' : 'concluida'}`}
                            </Badge>
                          ) : null}
                          {returnTypeLabels.map((label) => (
                            <Badge
                              key={`${danfe.invoice_number}-return-type-${label}`}
                              tone="danger"
                              className="h-auto px-2 py-0.5 text-[10px] leading-tight"
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                        {latestOccurrence ? (
                          <div
                            className={cn(
                              'mt-2 rounded-md border px-2 py-1 text-[11px]',
                              getSemanticToneClassName(latestOccurrenceTone, 'panel'),
                            )}
                            title={latestOccurrenceDescription}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide">
                              {getOccurrenceStatusLabel(latestOccurrence.status)}
                            </p>
                            <p className="truncate">{latestOccurrenceDescription}</p>
                          </div>
                        ) : null}
                      </div>

                      <ContainerItems className="min-h-0 flex-1">
                        {danfe.DanfeProducts.length > 4 && (
                          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-2 py-1">
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
                          <span>Codigo</span>
                          <span>Descricao</span>
                          <span>Qtd</span>
                        </DescriptionColumns>
                        <ItemsScrollArea aria-label={`Itens da NF ${danfe.invoice_number}`}>
                          {danfe.DanfeProducts.map((item) => (
                            <ListItems key={`${danfe.invoice_number}-${item.Product.code}`}>
                              <li>{item.Product.code}</li>
                              <li title={normalizeTextValue(item.Product.description)}>{normalizeTextValue(item.Product.description)}</li>
                              <li>{formatQuantity(item.quantity, item.type)}</li>
                            </ListItems>
                          ))}
                        </ItemsScrollArea>
                      </ContainerItems>
                    </div>

                    <TotalQuantity className="mt-2 shrink-0 flex items-center justify-between gap-2">
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
                    className={cn(
                      'absolute inset-0 select-text overflow-hidden',
                      getOperationalStatusCardClassName(danfe.status),
                    )}
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  >
                    <TitleCard className="shrink-0">
                      <h1>{`NF ${danfe.invoice_number}`}</h1>
                      <h4>Detalhes</h4>
                    </TitleCard>
                    <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
                      <div className="space-y-2 text-sm">
                        <p><strong>Cliente:</strong> {customerName}</p>
                        <p><strong>Status:</strong> {danfeStatusLabel}</p>
                        <p><strong>Endereco:</strong> {customerAddress}</p>
                        <p><strong>Cidade:</strong> {cityName}</p>
                        <p><strong>Telefone:</strong> {normalizeTextValue(danfe.Customer.phone) || '-'}</p>
                        <p><strong>Carga:</strong> {danfe.load_number || '-'}</p>
                        <p><strong>Motorista:</strong> {resolvedDriverName || 'Sem motorista'}</p>
                        {latestOccurrence ? (
                          <>
                            <p><strong>Ultima ocorrencia:</strong> {latestOccurrenceDescription}</p>
                            <p><strong>Status da ocorrencia:</strong> {getOccurrenceDetailStatusLabel(latestOccurrence.status)}</p>
                          </>
                        ) : null}
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
                    </div>
                    <TotalQuantity className="mt-2 shrink-0 flex items-center justify-between gap-2">
                      <p>Use o botao Voltar</p>
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
      ) : (
        <div className="mx-auto w-full max-w-[1200px] rounded-lg border semantic-panel-neutral px-4 py-6 text-center text-sm">
          Nenhuma NF corresponde ao filtro de borda selecionado.
        </div>
      )}

      {productsModalDanfe ? (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center p-3">
          <button
            type="button"
            aria-label="Fechar lista de produtos"
            className="absolute inset-0 bg-slate-950/80"
            onClick={closeProductsModal}
          />
          <div className="relative z-[1410] flex max-h-[88vh] w-full max-w-[680px] flex-col rounded-lg border border-border bg-card p-3 text-text shadow-[0_14px_34px_rgba(0,0,0,0.55)]">
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
                <span>Codigo</span>
                <span>Descricao</span>
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
  );
}

export default memo(CardDanfes);
