import { useState } from 'react';
import { IDanfe } from '../types/types'
import { CardsDanfe, ContainerCards, ContainerItems, DescriptionColumns, ListItems, TitleCard, TotalQuantity } from '../style/CardDanfes';

interface CardDanfesProps {
  danfes: IDanfe[];
  animationKey?: string;
  driverByInvoice?: Record<string, string>;
}

function CardDanfes({ danfes, animationKey, driverByInvoice = {} } : CardDanfesProps) {
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

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

  return (
    <ContainerCards key={animationKey}>
      { danfes.map((danfe) => {
        const key = String(danfe.barcode || danfe.invoice_number);
        const isFlipped = Boolean(flippedCards[key]);
        const driverName = driverByInvoice[String(danfe.invoice_number)];

        return (
          <div key={key} className="h-[350px] w-full max-w-[360px] [perspective:1200px]">
            <div
              className="relative h-full w-full transition-transform duration-500"
              style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
              <CardsDanfe
                className={!driverName ? 'absolute inset-0 select-text border-accent/55 shadow-[0_0_0_1px_rgba(1,87,163,0.25)]' : 'absolute inset-0 select-text'}
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
                  <h4>{danfe.invoice_date}</h4>
                </TitleCard>
                <h4 className="mt-1 text-sm font-semibold leading-tight">{danfe.Customer.name_or_legal_entity}</h4>
                <p className="text-xs text-muted">{danfe.Customer.city}</p>
                <ContainerItems>
                  <DescriptionColumns>
                    <span>Código</span>
                    <span>Descrição</span>
                    <span>Qtd</span>
                  </DescriptionColumns>
                  {danfe.DanfeProducts.map((item, index) => (
                    <ListItems key={ `${danfe.invoice_number}-${item.Product.code}` }>
                        <li>{item.Product.code}</li>
                        <li title={item.Product.description}>{item.Product.description}</li>
                        <li>{formatQuantity(item.quantity, item.type)}</li>
                    </ListItems>
                  ))}
                </ContainerItems>
                <TotalQuantity className="flex items-center justify-between gap-2">
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
                className="absolute inset-0 select-text"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <TitleCard>
                  <h1>{`NF ${danfe.invoice_number}`}</h1>
                  <h4>Detalhes</h4>
                </TitleCard>
                <div className="mt-2 space-y-2 text-sm">
                  <p><strong>Cliente:</strong> {danfe.Customer.name_or_legal_entity}</p>
                  <p><strong>Endereço:</strong> {danfe.Customer.address}</p>
                  <p><strong>Cidade:</strong> {danfe.Customer.city}</p>
                  <p><strong>Telefone:</strong> {danfe.Customer.phone || '-'}</p>
                  <p><strong>Carga:</strong> {danfe.load_number || '-'}</p>
                  <p><strong>Motorista:</strong> {driverName || 'Sem motorista'}</p>
                </div>
                <TotalQuantity className="flex items-center justify-between gap-2">
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
  )
}

export default CardDanfes;
