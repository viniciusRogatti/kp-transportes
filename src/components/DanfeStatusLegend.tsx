import { DANFE_STATUS_LEGEND, DanfeLegendKey, getDanfeLegendItem, getSemanticToneClassName } from '../utils/statusStyles';
import { cn } from '../lib/cn';

interface DanfeStatusLegendProps {
  activeStatusFilter: DanfeLegendKey | '';
  onChange: (next: DanfeLegendKey | '') => void;
  totalCount: number;
  filteredCount: number;
}

export default function DanfeStatusLegend({
  activeStatusFilter,
  onChange,
  totalCount,
  filteredCount,
}: DanfeStatusLegendProps) {
  const activeLegendItem = activeStatusFilter ? getDanfeLegendItem(activeStatusFilter) : null;

  return (
    <div className="mx-auto mb-s3 w-full max-w-[1200px] rounded-lg border border-border bg-surface/90 p-s3" data-testid="danfe-status-legend">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Status da NF
        </p>
        {DANFE_STATUS_LEGEND.map((item) => {
          const isActive = activeStatusFilter === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(isActive ? '' : item.key)}
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
            onClick={() => onChange('')}
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
          {`Filtro ativo: ${activeLegendItem.label}. Exibindo ${filteredCount} de ${totalCount} NF(s).`}
        </p>
      ) : null}
    </div>
  );
}
