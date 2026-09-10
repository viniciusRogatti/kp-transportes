import { useId, useState } from 'react';

type Props = { label: string; values: string[]; options: Array<{ value: string; label: string }>; onChange: (values: string[]) => void };

export default function MultiSelectFilter({ label, values, options, onChange }: Props) {
  const id = useId();
  const [search, setSearch] = useState('');
  const term = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visible = options.filter((option) => option.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(term));
  return (
    <details className="relative min-w-0 rounded-md border border-border bg-card text-sm" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); }
    }}>
      <summary role="button" aria-label={`Filtrar ${label.toLowerCase()}`} className="cursor-pointer p-2.5 font-medium text-text">{label}: {values.length ? `${values.length} selecionado(s)` : 'Todos'}</summary>
      <div className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[80vw] rounded-md border border-border bg-card p-3 shadow-elevated max-sm:static max-sm:w-full max-sm:max-w-none">
        <label htmlFor={id} className="sr-only">Buscar {label.toLowerCase()}</label>
        <input id={id} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar opções" className="mb-2 h-9 w-full rounded border border-border bg-surface px-2 text-text" />
        <div className="max-h-56 overflow-y-auto" role="group" aria-label={label}>
          {visible.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded p-2 text-text hover:bg-surface-2">
              <input type="checkbox" checked={values.includes(option.value)} onChange={() => onChange(values.includes(option.value)
                ? values.filter((value) => value !== option.value) : [...values, option.value])} />
              {option.label}
            </label>
          ))}
          {!visible.length ? <p className="p-2 text-muted">Nenhuma opção encontrada.</p> : null}
        </div>
        {values.length ? <button type="button" className="mt-2 text-accent underline" onClick={() => onChange([])}>Limpar seleção</button> : null}
      </div>
    </details>
  );
}
