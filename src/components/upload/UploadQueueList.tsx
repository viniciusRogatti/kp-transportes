import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export type UploadQueueStatus = 'ready' | 'uploading' | 'success' | 'error';

export interface UploadQueueItem {
  id: string;
  file: File;
  status: UploadQueueStatus;
  errorMessage?: string;
  warningCount?: number;
}

interface UploadQueueListProps {
  items: UploadQueueItem[];
  disabled?: boolean;
  onRemove: (id: string) => void;
}

const ROW_HEIGHT = 52;
const VIEWPORT_HEIGHT = 320;
const OVERSCAN = 6;

const statusLabel: Record<UploadQueueStatus, string> = {
  ready: 'Pronto',
  uploading: 'Enviando',
  success: 'Sucesso',
  error: 'Erro',
};

const statusClassName: Record<UploadQueueStatus, string> = {
  ready: 'border-slate-600 bg-slate-900/70 text-slate-200',
  uploading: 'border-sky-500/45 bg-sky-900/40 text-sky-200',
  success: 'border-emerald-500/45 bg-emerald-900/35 text-emerald-200',
  error: 'border-rose-500/45 bg-rose-900/35 text-rose-200',
};

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / (1024 ** power);
  return `${size.toFixed(power === 0 ? 0 : 2)} ${units[power]}`;
};

function UploadQueueList({ items, disabled = false, onRemove }: UploadQueueListProps) {
  const [scrollTop, setScrollTop] = useState(0);

  const { startIndex, visibleItems } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2;
    const end = Math.min(items.length, start + visibleCount);
    return {
      startIndex: start,
      visibleItems: items.slice(start, end),
    };
  }, [items, scrollTop]);

  return (
    <div className="w-full rounded-xl border border-white/10 bg-[rgba(8,21,33,0.72)] p-4 shadow-[var(--shadow-1)]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Fila de envio</h3>
        <span className="text-xs text-muted">{items.length} arquivo(s)</span>
      </div>

      {!items.length ? (
        <div className="rounded-md border border-white/10 bg-surface/50 px-3 py-5 text-center text-sm text-muted">
          Nenhum arquivo selecionado.
        </div>
      ) : (
        <div
          className="scrollbar-ui w-full overflow-y-auto rounded-md border border-white/10 bg-[rgba(5,14,22,0.4)]"
          style={{ height: VIEWPORT_HEIGHT }}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <div style={{ height: items.length * ROW_HEIGHT, position: 'relative' }}>
            {visibleItems.map((item, offset) => {
              const index = startIndex + offset;
              const top = index * ROW_HEIGHT;

              return (
                <div
                  key={item.id}
                  style={{ top, height: ROW_HEIGHT }}
                  className="absolute left-0 right-0 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-white/10 px-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[0.84rem] font-medium text-text">{item.file.name}</p>
                    <p className="truncate text-[0.75rem] text-muted">
                      {formatBytes(item.file.size)}
                      {item.errorMessage ? ` • ${item.errorMessage}` : ''}
                      {item.warningCount ? ` • ${item.warningCount} alerta(s)` : ''}
                    </p>
                  </div>

                  <span className={cn(
                    'inline-flex h-7 items-center rounded-full border px-2 text-[0.68rem] font-semibold uppercase tracking-wide',
                    statusClassName[item.status],
                  )}
                  >
                    {statusLabel[item.status]}
                  </span>

                  <button
                    type="button"
                    disabled={disabled || item.status === 'uploading'}
                    onClick={() => onRemove(item.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-surface/80 text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={`Remover ${item.file.name}`}
                    title="Remover arquivo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadQueueList;
