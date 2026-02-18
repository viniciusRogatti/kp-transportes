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
import { ControlTowerFilters, ReturnsTableRow } from '../../types/controlTower';
import { currencyFmt, decimalFmt, formatDateTime, numberFmt } from './format';

interface ReturnsTableProps {
  rows: ReturnsTableRow[];
  total: number;
  loading?: boolean;
  returnTypeFilter: ControlTowerFilters['returnType'];
  pageIndex: number;
  pageSize: number;
  sorting: SortingState;
  onPaginationChange: (pageIndex: number) => void;
  onSortingChange: OnChangeFn<SortingState>;
  onFilterByReturnType: (returnType: ControlTowerFilters['returnType']) => void;
  onOpenDetails: (id: string) => void;
}

const returnTypeFilterTabs: Array<{ value: ControlTowerFilters['returnType']; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'total', label: 'Total' },
  { value: 'partial', label: 'Parcial' },
  { value: 'coleta', label: 'Coleta' },
  { value: 'sobra', label: 'Sobra' },
];

function getReturnTypeLabel(returnType: ReturnsTableRow['returnType']) {
  if (returnType === 'total') return 'Total';
  if (returnType === 'partial') return 'Parcial';
  if (returnType === 'coleta') return 'Coleta';
  if (returnType === 'sobra') return 'Sobra';
  return 'Nao informado';
}

function ReturnsTable({
  rows,
  total,
  loading,
  returnTypeFilter,
  pageIndex,
  pageSize,
  sorting,
  onPaginationChange,
  onSortingChange,
  onFilterByReturnType,
  onOpenDetails,
}: ReturnsTableProps) {
  const columns = useMemo<ColumnDef<ReturnsTableRow>[]>(() => [
    {
      accessorKey: 'invoiceNumber',
      header: 'NF',
      cell: ({ row }) => <button className="text-left text-sky-300 underline" onClick={() => onOpenDetails(row.original.id)}>{row.original.invoiceNumber}</button>,
    },
    { accessorKey: 'batchCode', header: 'Lote' },
    { accessorKey: 'returnType', header: 'Tipo', cell: ({ row }) => getReturnTypeLabel(row.original.returnType) },
    { accessorKey: 'customer', header: 'Cliente' },
    { accessorKey: 'city', header: 'Cidade' },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'quantity', header: 'Qtd', cell: ({ row }) => numberFmt.format(row.original.quantity) },
    { accessorKey: 'weightKg', header: 'Peso (kg)', cell: ({ row }) => decimalFmt.format(row.original.weightKg) },
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
    <Card className="border-slate-800 bg-[#101b2b] text-slate-100">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Detalhamento de devoluções</h3>
        <span className="text-xs text-slate-400">{total} registros</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {returnTypeFilterTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onFilterByReturnType(tab.value)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              returnTypeFilter === tab.value
                ? 'border-sky-600 bg-sky-900/35 text-sky-100'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {loading ? <p className="mb-2 text-sm text-slate-400">Atualizando tabela...</p> : null}

      <div className="max-h-[360px] overflow-auto rounded-md border border-slate-700">
        <table className="w-full min-w-[1060px] text-sm">
          <thead className="bg-slate-900/80">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowDownUp className="h-3 w-3 text-slate-500" />
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-800/80 hover:bg-slate-900/70">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-1.5 text-slate-200">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="px-2 py-6 text-center text-slate-400" colSpan={columns.length}>Nenhum registro com os filtros atuais.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 text-sm">
        <Button tone="secondary" className="h-8 bg-slate-800 text-slate-100" onClick={() => onPaginationChange(pageIndex - 1)} disabled={!canPrev}>Anterior</Button>
        <span className="text-slate-300">Página {pageIndex + 1}</span>
        <Button tone="secondary" className="h-8 bg-slate-800 text-slate-100" onClick={() => onPaginationChange(pageIndex + 1)} disabled={!canNext}>Próxima</Button>
      </div>
    </Card>
  );
}

export default ReturnsTable;
