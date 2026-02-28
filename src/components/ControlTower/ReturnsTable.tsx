import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  OnChangeFn,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';
import { ArrowDownUp } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Input from '../ui/Input';
import { ControlTowerFilters, ReturnsTableRow } from '../../types/controlTower';
import { currencyFmt, formatDateTime, numberFmt } from './format';
import { useTheme } from '../../context/ThemeContext';

interface ReturnsTableProps {
  rows: ReturnsTableRow[];
  total: number;
  loading?: boolean;
  returnTypeFilter: ControlTowerFilters['returnType'];
  search: string;
  pageIndex: number;
  pageSize: number;
  sorting: SortingState;
  onPaginationChange: (pageIndex: number) => void;
  onSortingChange: OnChangeFn<SortingState>;
  onSearchChange: (search: string) => void;
  onFilterByReturnType: (returnType: ControlTowerFilters['returnType']) => void;
  onOpenDetails: (id: string) => void;
}

const returnTypeFilterTabs: Array<{ value: ControlTowerFilters['returnType']; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'total', label: 'Total' },
  { value: 'partial', label: 'Parcial' },
  { value: 'coleta', label: 'Coleta' },
  { value: 'sobra', label: 'Sobra' },
  { value: 'faltante', label: 'Faltante' },
];

function getReturnTypeLabel(returnType: ReturnsTableRow['returnType']) {
  if (returnType === 'total') return 'Total';
  if (returnType === 'partial') return 'Parcial';
  if (returnType === 'coleta') return 'Coleta';
  if (returnType === 'sobra') return 'Sobra';
  if (returnType === 'faltante') return 'Faltante';
  return 'Nao informado';
}

function getFlowOriginLabel(flowOrigin: ReturnsTableRow['flowOrigin']) {
  return flowOrigin === 'ocorrencia' ? 'Ocorrência' : 'Devolução';
}

function getStatusLabel(status: string) {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'PENDENTE') return 'Pendente';
  if (normalized === 'SOLICITADA') return 'Solicitada';
  if (normalized === 'EM_ROTA') return 'Em rota';
  if (normalized === 'COLETADA') return 'Coletada';
  if (normalized === 'CANCELADA') return 'Cancelada';
  if (normalized === 'PENDENTE_TRANSPORTADORA') return 'Pendente transportadora';
  if (normalized === 'PENDENTE_CREDITO') return 'Pendente de crédito';
  if (normalized === 'CREDITO_CONCLUIDO') return 'Crédito concluído';
  if (normalized === 'FINALIZADA') return 'Finalizada';
  return status || '-';
}

function ReturnsTable({
  rows,
  total,
  loading,
  returnTypeFilter,
  search,
  pageIndex,
  pageSize,
  sorting,
  onPaginationChange,
  onSortingChange,
  onSearchChange,
  onFilterByReturnType,
  onOpenDetails,
}: ReturnsTableProps) {
  const { isLightTheme } = useTheme();
  const selectedReturnTypeFilterClass = isLightTheme
    ? 'ct-light-active-filter border-sky-600 bg-sky-100 text-[color:var(--color-text-accent)]'
    : 'border-sky-500/65 bg-sky-900/55 text-sky-100';

  const columns = useMemo<ColumnDef<ReturnsTableRow>[]>(() => [
    { accessorKey: 'flowOrigin', header: 'Fluxo', cell: ({ row }) => getFlowOriginLabel(row.original.flowOrigin) },
    {
      accessorKey: 'invoiceNumber',
      header: 'NF / Referência',
      cell: ({ row }) => (
        row.original.flowOrigin === 'devolucao'
          ? <button className="text-left text-sky-300 underline" onClick={() => onOpenDetails(row.original.id)}>{row.original.invoiceNumber}</button>
          : <span className="text-[color:var(--color-warning)]">{row.original.invoiceNumber}</span>
      ),
    },
    { accessorKey: 'batchCode', header: 'Lote / Origem' },
    {
      accessorKey: 'returnType',
      header: 'Tipo',
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5">
          <span>{getReturnTypeLabel(row.original.returnType)}</span>
          {row.original.returnType === 'sobra' && row.original.isInversion ? (
            <span className="rounded-full border border-amber-400/70 bg-amber-500/20 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-warning)]">
              Inversao
            </span>
          ) : null}
        </span>
      ),
    },
    { accessorKey: 'customer', header: 'Cliente' },
    { accessorKey: 'city', header: 'Cidade' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => getStatusLabel(row.original.status) },
    { accessorKey: 'quantity', header: 'Qtd', cell: ({ row }) => numberFmt.format(row.original.quantity) },
    { accessorKey: 'valueAmount', header: 'Valor', cell: ({ row }) => currencyFmt.format(row.original.valueAmount) },
    { accessorKey: 'confirmedAt', header: 'Confirmado em', cell: ({ row }) => formatDateTime(row.original.confirmedAt) },
  ], [onOpenDetails]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  const canPrev = pageIndex > 0;
  const canNext = (pageIndex + 1) * pageSize < total;

  return (
    <Card className="border-border bg-card text-text">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Fluxo operacional (devoluções e ocorrências)</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por NF, lote, cliente, cidade ou produto"
            className="h-9 w-[320px] border-accent/35 bg-surface-2/85 text-text focus:ring-accent/60"
          />
          <span className="text-xs text-muted">{total} registros</span>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {returnTypeFilterTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onFilterByReturnType(tab.value)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              returnTypeFilter === tab.value
                ? selectedReturnTypeFilterClass
                : 'border-border bg-card text-muted hover:border-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {loading ? <p className="mb-2 text-sm text-muted">Atualizando tabela...</p> : null}

      <div className="max-h-[360px] overflow-auto rounded-md border border-border">
        <table className="w-full min-w-[1060px] text-sm">
          <thead className="bg-card">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowDownUp className="h-3 w-3 text-muted" />
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-border hover:bg-card">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-1.5 text-text">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="px-2 py-6 text-center text-muted" colSpan={columns.length}>Nenhum registro com os filtros atuais.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 text-sm">
        <Button tone="secondary" className="h-8 bg-surface-2 text-text" onClick={() => onPaginationChange(pageIndex - 1)} disabled={!canPrev}>Anterior</Button>
        <span className="text-muted">Página {pageIndex + 1}</span>
        <Button tone="secondary" className="h-8 bg-surface-2 text-text" onClick={() => onPaginationChange(pageIndex + 1)} disabled={!canNext}>Próxima</Button>
      </div>
    </Card>
  );
}

export default ReturnsTable;
