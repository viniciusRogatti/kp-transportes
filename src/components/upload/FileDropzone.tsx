import { ChangeEvent, useRef, useState } from 'react';
import { CheckCircle2, UploadCloud } from 'lucide-react';
import { cn } from '../../lib/cn';

interface FileDropzoneProps {
  disabled?: boolean;
  onSelectFiles: (files: File[]) => void;
  accept?: string;
  selectedCount?: number;
  totalSizeLabel?: string;
}

function FileDropzone({
  disabled = false,
  onSelectFiles,
  accept = '.xml,text/xml,application/xml',
  selectedCount = 0,
  totalSizeLabel = '0 B',
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const hasSelection = selectedCount > 0;

  function openFilePicker() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length) {
      onSelectFiles(files);
    }
    event.target.value = '';
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const files = Array.from(event.dataTransfer.files || []);
    if (files.length) {
      onSelectFiles(files);
    }
  }

  return (
    <div className="w-full rounded-xl border border-border bg-surface/80 p-4 shadow-[var(--shadow-1)]">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
      />

      <div
        onDrop={handleDrop}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled) setIsDragOver(true);
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragOver(false);
        }}
        className={cn(
          'flex min-h-[170px] w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition',
          isDragOver
            ? 'border-accent/65 bg-accent/10'
            : hasSelection
              ? 'border-emerald-500/45 bg-emerald-500/12'
              : 'border-border bg-surface/60',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        )}
        onClick={openFilePicker}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openFilePicker();
          }
        }}
      >
        {hasSelection ? (
          <CheckCircle2 className="mb-3 h-10 w-10 text-[color:var(--color-success)]" />
        ) : (
          <UploadCloud className="mb-3 h-10 w-10 text-text-accent" />
        )}
        <p className="text-sm font-semibold text-text">
          {hasSelection ? `${selectedCount} arquivo(s) selecionado(s)` : 'Arraste e solte XMLs aqui'}
        </p>
        <p className="mt-1 text-xs text-muted">
          {hasSelection
            ? `Total ${totalSizeLabel} • adicione mais arquivos se necessário`
            : 'ou clique para selecionar arquivos'}
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            openFilePicker();
          }}
          className="mt-4 inline-flex h-9 items-center rounded-md border border-accent/40 bg-card px-3 text-xs font-semibold text-text hover:border-accent/70 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {hasSelection ? 'Adicionar mais arquivos' : 'Selecionar arquivos'}
        </button>
      </div>
    </div>
  );
}

export default FileDropzone;
