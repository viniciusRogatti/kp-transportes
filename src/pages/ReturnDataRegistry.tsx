import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  FileSearch,
  History,
  Pencil,
  RefreshCcw,
  Save,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '../components/Header';
import { Container } from '../style/invoices';
import verifyToken from '../utils/verifyToken';
import { handleAuthenticationError } from '../utils/authErrorHandler';
import {
  confirmReturnDataImport,
  exportReturnRegistryOccurrences,
  getReturnDataOverview,
  getReturnRegistryOccurrenceHistory,
  listReturnDataImports,
  listReturnRegistryOccurrences,
  previewReturnDataImport,
  ReturnDataFilters,
  ReturnDataImport,
  ReturnDataImportPreview,
  ReturnDataOverview,
  ReturnDataType,
  ReturnRegistryOccurrence,
  updateReturnRegistryOccurrenceType,
} from '../services/returnDataService';

type RegistryTab = 'overview' | 'occurrences' | 'imports';

const EMPTY_FILTERS: ReturnDataFilters = {
  invoice_number: '',
  source_occurrence_id: '',
  customer: '',
  seller: '',
  product: '',
  reason: '',
  approval_status: '',
  return_type: '',
  carrier: '',
  start_date: '',
  end_date: '',
  linked: '',
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const numberFormatter = new Intl.NumberFormat('pt-BR');

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const APPROVAL_LABELS: Record<string, string> = {
  approved: 'Aprovada',
  rejected: 'Reprovada',
  unknown: 'Não classificada',
};

const RETURN_TYPE_LABELS: Record<string, string> = {
  total: 'Total',
  partial: 'Parcial',
  collection: 'Coleta',
  coleta: 'Coleta',
  surplus: 'Sobra',
  sobra: 'Sobra',
  weight_break: 'Quebra de peso',
  unclassified: 'Não classificado',
};

const RETURN_VALUE_SOURCE_LABELS: Record<string, string> = {
  invoice_total: 'total da NF, pois a devolução é total',
  weight_break_percentage: 'percentual informado sobre o item',
  unavailable: 'a planilha não informa quantidade ou valor devolvido',
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return String(error.response?.data?.message || error.response?.data?.error || fallback);
  }
  return error instanceof Error ? error.message : fallback;
};

function HorizontalChart({
  title,
  data,
  onSelect,
}: {
  title: string;
  data: Array<{ label: string; count: number }>;
  onSelect?: (label: string) => void;
}) {
  const reversed = data.slice(0, 10).reverse();
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-soft">
      <h3 className="mb-2 text-sm font-bold text-text">{title}</h3>
      {reversed.length ? (
        <ReactECharts
          style={{ height: Math.max(230, reversed.length * 34) }}
          option={{
            animationDuration: 300,
            grid: { left: 8, right: 30, top: 8, bottom: 8, containLabel: true },
            tooltip: {
              trigger: 'axis',
              axisPointer: { type: 'shadow' },
              formatter: (params: any[]) => `${params?.[0]?.name || ''}: ${numberFormatter.format(params?.[0]?.value || 0)} ocorrência(s)`,
            },
            xAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#64748b' } },
            yAxis: {
              type: 'category',
              data: reversed.map((item) => item.label),
              axisLabel: { width: 150, overflow: 'truncate', color: '#64748b' },
            },
            series: [{
              type: 'bar',
              data: reversed.map((item) => item.count),
              itemStyle: { color: '#2563eb', borderRadius: [0, 5, 5, 0] },
              label: { show: true, position: 'right' },
            }],
          }}
          onEvents={onSelect ? {
            click: (params: any) => onSelect(String(params.name || '')),
          } : undefined}
        />
      ) : (
        <p className="py-12 text-center text-sm text-muted">Sem dados para os filtros selecionados.</p>
      )}
    </div>
  );
}

function FilterFields({
  filters,
  onChange,
  compact = false,
}: {
  filters: ReturnDataFilters;
  onChange: (field: keyof ReturnDataFilters, value: string) => void;
  compact?: boolean;
}) {
  const fieldClass = 'h-10 min-w-0 rounded-md border border-border bg-card px-3 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';
  const openDatePicker = (event: ReactMouseEvent<HTMLInputElement>) => {
    try {
      event.currentTarget.showPicker?.();
    } catch (error) {
      // Alguns navegadores restringem showPicker fora da interação direta.
    }
  };
  return (
    <div className={`grid gap-2 ${compact ? 'md:grid-cols-3 xl:grid-cols-6' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
      {!compact ? (
        <>
          <input className={fieldClass} value={filters.invoice_number || ''} onChange={(event) => onChange('invoice_number', event.target.value)} placeholder="NF" aria-label="Filtrar base por NF" />
          <input className={fieldClass} value={filters.source_occurrence_id || ''} onChange={(event) => onChange('source_occurrence_id', event.target.value)} placeholder="ID da ocorrência" aria-label="Filtrar por ID da ocorrência" />
        </>
      ) : null}
      <select className={fieldClass} value={filters.approval_status || ''} onChange={(event) => onChange('approval_status', event.target.value)} aria-label="Filtrar por aprovação">
        <option value="">Todos os status</option>
        <option value="approved">Aprovadas</option>
        <option value="rejected">Reprovadas</option>
        <option value="unknown">Não classificadas</option>
      </select>
      <select className={fieldClass} value={filters.return_type || ''} onChange={(event) => onChange('return_type', event.target.value)} aria-label="Filtrar por tipo de devolução">
        <option value="">Todos os tipos</option>
        <option value="total">Total</option>
        <option value="partial">Parcial</option>
        <option value="collection">Coleta</option>
        <option value="surplus">Sobra</option>
        <option value="weight_break">Quebra de peso</option>
        <option value="unclassified">Não classificado</option>
      </select>
      <input className={fieldClass} value={filters.customer || ''} onChange={(event) => onChange('customer', event.target.value)} placeholder="Cliente" aria-label="Filtrar por cliente" />
      <input className={fieldClass} value={filters.seller || ''} onChange={(event) => onChange('seller', event.target.value)} placeholder="Representante" aria-label="Filtrar por representante" />
      <input className={fieldClass} value={filters.product || ''} onChange={(event) => onChange('product', event.target.value)} placeholder="Produto" aria-label="Filtrar por produto" />
      {!compact ? (
        <>
          <input className={fieldClass} value={filters.reason || ''} onChange={(event) => onChange('reason', event.target.value)} placeholder="Categoria do motivo" aria-label="Filtrar por motivo" />
          <input className={fieldClass} value={filters.carrier || ''} onChange={(event) => onChange('carrier', event.target.value)} placeholder="Transportadora" aria-label="Filtrar por transportadora" />
          <select className={fieldClass} value={filters.linked || ''} onChange={(event) => onChange('linked', event.target.value)} aria-label="Filtrar por vínculo com lote">
            <option value="">Com ou sem lote</option>
            <option value="yes">Com lote vinculado</option>
            <option value="no">Sem lote vinculado</option>
          </select>
        </>
      ) : null}
      <input className={`${fieldClass} cursor-pointer`} type="date" value={filters.start_date || ''} onClick={openDatePicker} onChange={(event) => onChange('start_date', event.target.value)} aria-label="Período inicial da base" />
      <input className={`${fieldClass} cursor-pointer`} type="date" value={filters.end_date || ''} onClick={openDatePicker} onChange={(event) => onChange('end_date', event.target.value)} aria-label="Período final da base" />
    </div>
  );
}

function ReturnDataRegistry() {
  const navigate = useNavigate();
  const permission = String(localStorage.getItem('user_permission') || '').toLowerCase();
  const canImport = ['admin', 'master', 'expedicao'].includes(permission);
  const canEdit = ['admin', 'master', 'expedicao'].includes(permission);
  const canExport = ['admin', 'master', 'expedicao', 'control_tower'].includes(permission);
  const [activeTab, setActiveTab] = useState<RegistryTab>('overview');
  const [filters, setFilters] = useState<ReturnDataFilters>({ ...EMPTY_FILTERS });
  const [overview, setOverview] = useState<ReturnDataOverview | null>(null);
  const [occurrences, setOccurrences] = useState<ReturnRegistryOccurrence[]>([]);
  const [occurrenceTotal, setOccurrenceTotal] = useState(0);
  const [occurrencePage, setOccurrencePage] = useState(1);
  const [occurrenceTotalPages, setOccurrenceTotalPages] = useState(1);
  const [imports, setImports] = useState<ReturnDataImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [expandedOccurrenceId, setExpandedOccurrenceId] = useState<number | null>(null);
  const [historyByOccurrence, setHistoryByOccurrence] = useState<Record<number, any[]>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ReturnDataImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState('');
  const [editingOccurrenceId, setEditingOccurrenceId] = useState<number | null>(null);
  const [editingReturnType, setEditingReturnType] = useState<ReturnDataType>('unclassified');
  const [savingReturnType, setSavingReturnType] = useState(false);

  const updateFilter = (field: keyof ReturnDataFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const loadOverview = useCallback(async (nextFilters: ReturnDataFilters = filters) => {
    setLoading(true);
    setErrorMessage('');
    try {
      setOverview(await getReturnDataOverview(nextFilters));
    } catch (error) {
      if (handleAuthenticationError(error)) return;
      setErrorMessage(getErrorMessage(error, 'Não foi possível carregar os indicadores.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadOccurrences = useCallback(async (page = occurrencePage, nextFilters = filters) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await listReturnRegistryOccurrences({ ...nextFilters, page, limit: 25 });
      setOccurrences(result.rows);
      setOccurrenceTotal(result.total);
      setOccurrencePage(result.page);
      setOccurrenceTotalPages(result.total_pages);
    } catch (error) {
      if (handleAuthenticationError(error)) return;
      setErrorMessage(getErrorMessage(error, 'Não foi possível consultar a base.'));
    } finally {
      setLoading(false);
    }
  }, [filters, occurrencePage]);

  const loadImports = useCallback(async () => {
    try {
      setImports(await listReturnDataImports());
    } catch (error) {
      if (handleAuthenticationError(error)) return;
      setErrorMessage(getErrorMessage(error, 'Não foi possível carregar as importações.'));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = localStorage.getItem('token');
      const valid = token ? await verifyToken(token) : false;
      if (!valid || !mounted) {
        if (!valid) navigate('/');
        return;
      }
      await Promise.all([loadOverview(EMPTY_FILTERS), loadImports()]);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'occurrences') void loadOccurrences(1);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = async () => {
    if (activeTab === 'overview') await loadOverview(filters);
    if (activeTab === 'occurrences') await loadOccurrences(1, filters);
  };

  const clearFilters = async () => {
    const empty = { ...EMPTY_FILTERS };
    setFilters(empty);
    if (activeTab === 'overview') await loadOverview(empty);
    if (activeTab === 'occurrences') await loadOccurrences(1, empty);
  };

  const openChartFilter = (field: keyof ReturnDataFilters, value: string) => {
    const nextFilters = { ...filters, [field]: value };
    setFilters(nextFilters);
    setActiveTab('occurrences');
    void loadOccurrences(1, nextFilters);
  };

  const loadHistory = async (occurrenceId: number) => {
    if (historyByOccurrence[occurrenceId]) return;
    try {
      const data = await getReturnRegistryOccurrenceHistory(occurrenceId);
      setHistoryByOccurrence((current) => ({ ...current, [occurrenceId]: data.changes || [] }));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Não foi possível carregar o histórico.'));
    }
  };

  const startEditingReturnType = (occurrence: ReturnRegistryOccurrence) => {
    setEditingOccurrenceId(occurrence.id);
    setEditingReturnType(occurrence.effective_return_type || occurrence.inferred_return_type);
    setErrorMessage('');
  };

  const saveReturnType = async (occurrence: ReturnRegistryOccurrence) => {
    if (savingReturnType) return;
    setSavingReturnType(true);
    setErrorMessage('');
    try {
      const updated = await updateReturnRegistryOccurrenceType(occurrence.id, editingReturnType);
      setOccurrences((current) => current.map((row) => row.id === updated.id
        ? { ...row, ...updated, internal_return_type: row.internal_return_type }
        : row));
      setHistoryByOccurrence((current) => {
        const next = { ...current };
        delete next[occurrence.id];
        return next;
      });
      setEditingOccurrenceId(null);
      await loadOverview(filters);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Não foi possível corrigir o tipo da devolução.'));
    } finally {
      setSavingReturnType(false);
    }
  };

  const handlePreviewImport = async () => {
    if (!selectedFile) {
      setImportFeedback('Selecione uma planilha XLSX.');
      return;
    }
    setImporting(true);
    setImportFeedback('');
    setImportPreview(null);
    try {
      setImportPreview(await previewReturnDataImport(selectedFile));
    } catch (error) {
      setImportFeedback(getErrorMessage(error, 'Não foi possível pré-visualizar a planilha.'));
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile || !importPreview || importPreview.duplicate_file) return;
    setImporting(true);
    setImportFeedback('');
    try {
      const result = await confirmReturnDataImport(selectedFile);
      setImportFeedback(result.message || 'Importação confirmada.');
      setImportPreview(null);
      setSelectedFile(null);
      await Promise.all([loadImports(), loadOverview(filters)]);
    } catch (error) {
      setImportFeedback(getErrorMessage(error, 'Não foi possível confirmar a importação.'));
    } finally {
      setImporting(false);
    }
  };

  const downloadIssues = () => {
    if (!importPreview) return;
    const issues = [
      ...(importPreview.errors || []).map((item) => ({ type: 'Erro', ...item })),
      ...(importPreview.warnings || []).map((item) => ({ type: 'Alerta', ...item })),
    ];
    const protect = (value: unknown) => {
      const text = String(value ?? '').replace(/"/g, '""');
      return `"${/^[=+\-@]/.test(text) ? `'${text}` : text}"`;
    };
    const csv = [
      ['Tipo', 'Linha', 'Código', 'Mensagem'].map(protect).join(';'),
      ...issues.map((item) => [item.type, item.row || '', item.code, item.message].map(protect).join(';')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'relatorio-importacao-devolucoes.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const metricCards = useMemo(() => overview ? [
    ['Ocorrências', overview.metrics.total_occurrences],
    ['NFs distintas', overview.metrics.distinct_invoices],
    ['Aprovadas', overview.metrics.approved_occurrences],
    ['Reprovadas', overview.metrics.rejected_occurrences],
    ['Aprovação', `${overview.metrics.approval_rate}%`],
    ['Valor devolvido calculável', currencyFormatter.format(overview.metrics.involved_value)],
    ['Sem valor calculável', overview.metrics.occurrences_without_calculable_value],
    ['Clientes', overview.metrics.distinct_customers],
    ['Sem lote', overview.metrics.unlinked_occurrences],
  ] : [], [overview]);

  return (
    <div className="min-h-screen">
      <Header />
      <Container>
        <section className="w-full space-y-3">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button type="button" onClick={() => navigate('/returns-occurrences?tab=returns')} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-text">
                <ArrowLeft size={14} /> Voltar para devoluções
              </button>
              <h1 className="flex items-center gap-2 text-xl font-bold text-text">
                <Database className="h-5 w-5 text-accent" /> Base de devoluções
              </h1>
              <p className="mt-1 text-sm text-muted">
                Base acumulada de ocorrências importadas. Os dados são orientativos e nunca bloqueiam um lote.
              </p>
            </div>
            <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
              {overview?.latest_import
                ? `Última atualização: ${formatDateTime(overview.latest_import.imported_at)}`
                : 'Base ainda não importada'}
            </div>
          </div>

          <nav className="flex overflow-x-auto rounded-lg border border-border bg-card p-1" aria-label="Seções da base de devoluções">
            {([
              ['overview', 'Visão geral', BarChart3],
              ['occurrences', 'Ocorrências', FileSearch],
              ['imports', 'Importações', Upload],
            ] as const).map(([tab, label, Icon]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`inline-flex min-w-max flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${activeTab === tab ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2 hover:text-text'}`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>

          {errorMessage ? (
            <div className="rounded-md border semantic-panel-danger px-3 py-2 text-sm">{errorMessage}</div>
          ) : null}

          {activeTab !== 'imports' ? (
            <div className="space-y-3 rounded-lg border border-border bg-card p-3 shadow-soft">
              <FilterFields filters={filters} onChange={updateFilter} compact={activeTab === 'overview'} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void applyFilters()} className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong">
                  <FileSearch size={15} /> Aplicar filtros
                </button>
                <button type="button" onClick={() => void clearFilters()} className="h-9 rounded-md border border-border bg-card px-4 text-sm font-semibold text-muted hover:bg-surface-2">
                  Limpar filtros
                </button>
                <button type="button" onClick={() => activeTab === 'overview' ? void loadOverview() : void loadOccurrences()} className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-muted hover:bg-surface-2">
                  <RefreshCcw size={15} /> Atualizar
                </button>
                {activeTab === 'occurrences' && canExport ? (
                  <button type="button" onClick={() => void exportReturnRegistryOccurrences(filters)} className="ml-auto inline-flex h-9 items-center gap-2 rounded-md border border-success bg-success px-4 text-sm font-semibold text-white">
                    <Download size={15} /> Exportar XLSX
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {loading && activeTab !== 'imports' ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted">Carregando base de devoluções...</div>
          ) : null}

          {!loading && activeTab === 'overview' && overview ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {metricCards.map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-border bg-card p-3 shadow-soft">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
                    <strong className="mt-1 block text-xl text-text">{typeof value === 'number' ? numberFormatter.format(value) : value}</strong>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                <HorizontalChart title="Clientes com mais devoluções" data={overview.charts.customers || []} onSelect={(value) => openChartFilter('customer', value)} />
                <HorizontalChart title="Principais motivos" data={overview.charts.reasons || []} onSelect={(value) => openChartFilter('reason', value)} />
                <HorizontalChart title="Representantes com mais devoluções" data={overview.charts.sellers || []} onSelect={(value) => openChartFilter('seller', value)} />
                <HorizontalChart title="Produtos mais recorrentes (ocorrências)" data={overview.charts.products || []} onSelect={(value) => openChartFilter('product', value)} />
                <HorizontalChart
                  title="Distribuição por tipo"
                  data={(overview.charts.return_types || []).map((item) => ({
                    ...item,
                    label: RETURN_TYPE_LABELS[item.label] || item.label,
                  }))}
                  onSelect={(value) => {
                    const status = Object.entries(RETURN_TYPE_LABELS).find(([, label]) => label === value)?.[0] || value;
                    openChartFilter('return_type', status);
                  }}
                />
                <HorizontalChart
                  title="Aprovadas versus reprovadas"
                  data={(overview.charts.approval_statuses || []).map((item) => ({
                    ...item,
                    label: APPROVAL_LABELS[item.label] || item.label,
                  }))}
                  onSelect={(value) => {
                    const status = Object.entries(APPROVAL_LABELS).find(([, label]) => label === value)?.[0] || value;
                    openChartFilter('approval_status', status);
                  }}
                />
                <HorizontalChart title="Evolução por mês de emissão da NF" data={overview.charts.timeline || []} />
                <HorizontalChart
                  title="Ocorrências vinculadas a lotes"
                  data={overview.charts.links || []}
                  onSelect={(value) => openChartFilter('linked', value === 'Vinculadas' ? 'yes' : 'no')}
                />
              </div>
            </div>
          ) : null}

          {!loading && activeTab === 'occurrences' ? (
            <div className="rounded-lg border border-border bg-card shadow-soft">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <p className="text-sm font-semibold text-text">{numberFormatter.format(occurrenceTotal)} ocorrência(s)</p>
                <p className="text-xs text-muted">Página {occurrencePage} de {occurrenceTotalPages}</p>
              </div>
              {!occurrences.length ? (
                <p className="p-8 text-center text-sm text-muted">Nenhuma ocorrência encontrada.</p>
              ) : (
                <div className="divide-y divide-border">
                  {occurrences.map((occurrence) => {
                    const expanded = expandedOccurrenceId === occurrence.id;
                    return (
                      <article key={occurrence.id} className="p-3">
                        <button
                          type="button"
                          onClick={() => setExpandedOccurrenceId(expanded ? null : occurrence.id)}
                          className="grid w-full gap-2 text-left md:grid-cols-[120px_110px_minmax(160px,1fr)_150px_140px_32px] md:items-center"
                          aria-expanded={expanded}
                        >
                          <strong className="text-sm text-text">ID {occurrence.source_occurrence_id}</strong>
                          <span className="text-sm font-semibold text-text">NF {occurrence.invoice_number}</span>
                          <span className="truncate text-sm text-muted">{occurrence.customer_name || '-'}</span>
                          <span className="text-xs text-muted">{RETURN_TYPE_LABELS[occurrence.internal_return_type || occurrence.effective_return_type] || occurrence.effective_return_type}</span>
                          <span className={`w-fit rounded-full border px-2 py-1 text-xs font-semibold ${occurrence.approval_status === 'approved' ? 'semantic-panel-success' : occurrence.approval_status === 'rejected' ? 'semantic-panel-danger' : 'semantic-panel-warning'}`}>
                            {APPROVAL_LABELS[occurrence.approval_status]}
                          </span>
                          <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                        {expanded ? (
                          <div className="mt-3 space-y-3 rounded-md border border-border bg-surface p-3 text-sm">
                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                              <span><strong>Representante:</strong> {occurrence.seller_name || '-'}</span>
                              <span><strong>CNPJ do cliente:</strong> {occurrence.customer_tax_id || '-'}</span>
                              <span><strong>Transportadora:</strong> {occurrence.carrier_name || '-'}</span>
                              <span><strong>Redespacho:</strong> {occurrence.redelivery_carrier_name || '-'}</span>
                              <span><strong>Emissão da NF:</strong> {occurrence.invoice_issued_at || '-'}</span>
                              <span>
                                <strong>Valor devolvido:</strong>{' '}
                                {occurrence.calculated_return_value === null
                                  ? 'Não calculável'
                                  : currencyFormatter.format(occurrence.calculated_return_value)}
                                <small className="ml-1 text-muted">
                                  ({RETURN_VALUE_SOURCE_LABELS[occurrence.return_value_source]})
                                </small>
                              </span>
                              <span><strong>Valor total da NF:</strong> {currencyFormatter.format(Number(occurrence.invoice_total_value || 0))}</span>
                              <span><strong>Lote:</strong> {occurrence.linked_batch_code || 'Sem lote vinculado'}</span>
                              <span><strong>Primeira importação:</strong> {formatDateTime(occurrence.first_seen_at)}</span>
                              <span><strong>Última atualização:</strong> {formatDateTime(occurrence.last_seen_at)}</span>
                              <span><strong>Categoria:</strong> {occurrence.return_reason_category}</span>
                            </div>
                            <div className="rounded-md border border-border bg-card p-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <strong>Tipo da devolução:</strong>{' '}
                                  <span className="font-semibold text-text">
                                    {RETURN_TYPE_LABELS[occurrence.effective_return_type] || occurrence.effective_return_type}
                                  </span>
                                  {occurrence.operational_return_type ? (
                                    <>
                                      <span className="ml-2 rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">Corrigido pela operação</span>
                                      <p className="mt-1 text-xs text-muted">
                                        Importado como {RETURN_TYPE_LABELS[occurrence.inferred_return_type] || occurrence.inferred_return_type}
                                        {occurrence.return_type_corrected_by_username ? ` · por ${occurrence.return_type_corrected_by_username}` : ''}
                                        {occurrence.return_type_corrected_at ? ` · ${formatDateTime(occurrence.return_type_corrected_at)}` : ''}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="mt-1 text-xs text-muted">Classificação inferida da planilha da MAR E RIO.</p>
                                  )}
                                </div>
                                {canEdit && editingOccurrenceId !== occurrence.id ? (
                                  <button type="button" onClick={() => startEditingReturnType(occurrence)} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border px-3 text-xs font-semibold hover:bg-surface">
                                    <Pencil size={14} /> Corrigir tipo
                                  </button>
                                ) : null}
                              </div>
                              {editingOccurrenceId === occurrence.id ? (
                                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
                                  <select aria-label={`Corrigir tipo da ocorrência ${occurrence.source_occurrence_id}`} value={editingReturnType} onChange={(event) => setEditingReturnType(event.target.value as ReturnDataType)} disabled={savingReturnType} className="h-10 rounded-md border border-border bg-surface px-3 text-sm">
                                    <option value="unclassified">Usar classificação importada ({RETURN_TYPE_LABELS[occurrence.inferred_return_type] || occurrence.inferred_return_type})</option>
                                    <option value="total">Total</option>
                                    <option value="partial">Parcial</option>
                                    <option value="collection">Coleta</option>
                                    <option value="weight_break">Quebra de peso</option>
                                    <option value="surplus">Sobra</option>
                                  </select>
                                  <button type="button" disabled={savingReturnType} onClick={() => void saveReturnType(occurrence)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50">
                                    <Save size={15} /> {savingReturnType ? 'Salvando...' : 'Salvar correção'}
                                  </button>
                                  <button type="button" disabled={savingReturnType} onClick={() => setEditingOccurrenceId(null)} className="h-10 rounded-md border border-border px-4 text-sm font-semibold disabled:opacity-50">Cancelar</button>
                                </div>
                              ) : null}
                            </div>
                            <div>
                              <strong>Motivo original:</strong>
                              <p className="mt-1 text-muted">{occurrence.return_reason_raw || '-'}</p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div><strong>Justificativa da devolução:</strong><p className="mt-1 text-muted">{occurrence.return_justification || '-'}</p></div>
                              <div><strong>Justificativa da aprovação:</strong><p className="mt-1 text-muted">{occurrence.approval_justification || '-'}</p></div>
                            </div>
                            <div>
                              <strong>Produtos ({occurrence.items.length}):</strong>
                              <ul className="mt-1 space-y-1">
                                {occurrence.items.length ? occurrence.items.map((item, index) => (
                                  <li key={`${occurrence.id}-${item.id || index}`} className="rounded border border-border bg-card px-2 py-1 text-muted">
                                    {item.product_description} · {currencyFormatter.format(Number(item.product_value || 0))}
                                  </li>
                                )) : <li className="text-muted">Nenhum produto detalhado.</li>}
                              </ul>
                            </div>
                            <button type="button" onClick={() => void loadHistory(occurrence.id)} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-muted hover:bg-surface-2">
                              <History size={14} /> Consultar histórico de alterações
                            </button>
                            {historyByOccurrence[occurrence.id] ? (
                              <div className="space-y-1">
                                <strong>Histórico:</strong>
                                {!historyByOccurrence[occurrence.id].length ? (
                                  <p className="text-muted">Esta ocorrência ainda não sofreu alterações.</p>
                                ) : historyByOccurrence[occurrence.id].map((change: any) => (
                                  <div key={change.id} className="rounded border border-border bg-card px-2 py-1 text-xs text-muted">
                                    {formatDateTime(change.created_at)}
                                    {change.change_source === 'operational_correction'
                                      ? ` · Correção operacional${change.changed_by_username ? ` por ${change.changed_by_username}` : ''}: ${RETURN_TYPE_LABELS[change.new_data_json?.effective_return_type] || change.new_data_json?.effective_return_type || '-'}`
                                      : ` · Importação${change.import?.original_file_name ? ` ${change.import.original_file_name}` : ''} · Campos alterados: ${(change.changed_fields_json || []).join(', ')}`}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center justify-center gap-2 border-t border-border p-3">
                <button type="button" disabled={occurrencePage <= 1} onClick={() => void loadOccurrences(occurrencePage - 1)} className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm disabled:opacity-40">
                  <ChevronLeft size={15} /> Anterior
                </button>
                <button type="button" disabled={occurrencePage >= occurrenceTotalPages} onClick={() => void loadOccurrences(occurrencePage + 1)} className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm disabled:opacity-40">
                  Próxima <ChevronRight size={15} />
                </button>
              </div>
            </div>
          ) : null}

          {activeTab === 'imports' ? (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
              <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-soft">
                <div>
                  <h2 className="text-base font-bold text-text">Importar planilha</h2>
                  <p className="mt-1 text-xs text-muted">
                    Aceita XLSX de até 10 MB. Primeiro revise a pré-visualização; nenhum dado é salvo antes da confirmação.
                  </p>
                </div>
                {!canImport ? (
                  <div className="rounded-md border semantic-panel-warning px-3 py-2 text-sm">
                    Seu perfil possui acesso somente para consulta.
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={(event) => {
                        setSelectedFile(event.target.files?.[0] || null);
                        setImportPreview(null);
                        setImportFeedback('');
                      }}
                      className="block w-full rounded-md border border-dashed border-border bg-surface p-3 text-sm text-muted"
                      aria-label="Planilha da base de devoluções"
                    />
                    <button type="button" disabled={!selectedFile || importing} onClick={() => void handlePreviewImport()} className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-45">
                      <Upload size={16} /> {importing ? 'Processando...' : 'Pré-visualizar'}
                    </button>
                  </>
                )}
                {importFeedback ? (
                  <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text">{importFeedback}</div>
                ) : null}
                {importPreview ? (
                  <div className={`space-y-3 rounded-lg border p-3 ${importPreview.duplicate_file ? 'semantic-panel-warning' : 'border-border bg-surface'}`}>
                    {importPreview.duplicate_file ? (
                      <div>
                        <strong>Arquivo já processado</strong>
                        <p className="mt-1 text-sm">{importPreview.message}</p>
                        <p className="mt-1 text-xs">Importação #{importPreview.existing_import?.id} em {formatDateTime(importPreview.existing_import?.imported_at)}</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {[
                            ['Linhas', importPreview.total_rows],
                            ['Ocorrências', importPreview.total_occurrences],
                            ['Novas', importPreview.created_occurrences],
                            ['Atualizadas', importPreview.updated_occurrences],
                            ['Sem alteração', importPreview.unchanged_occurrences],
                            ['Aprovadas', importPreview.approved_count],
                            ['Reprovadas', importPreview.rejected_count],
                            ['Inválidas', importPreview.invalid_occurrences],
                          ].map(([label, value]) => (
                            <div key={String(label)} className="rounded-md border border-border bg-card p-2">
                              <span className="block text-xs text-muted">{label}</span>
                              <strong>{Number(value || 0)}</strong>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted">
                          Período de emissão encontrado: {importPreview.detected_start_date || '-'} até {importPreview.detected_end_date || '-'}
                        </p>
                        {Boolean(importPreview.sample_occurrences?.length) ? (
                          <div className="overflow-x-auto rounded-md border border-border">
                            <table className="min-w-full text-left text-xs">
                              <thead className="bg-surface-2 text-muted">
                                <tr>
                                  <th className="px-2 py-1.5">ID</th>
                                  <th className="px-2 py-1.5">NF</th>
                                  <th className="px-2 py-1.5">Cliente</th>
                                  <th className="px-2 py-1.5">Status</th>
                                  <th className="px-2 py-1.5">Itens</th>
                                </tr>
                              </thead>
                              <tbody>
                                {importPreview.sample_occurrences?.map((occurrence) => (
                                  <tr key={occurrence.source_occurrence_id} className="border-t border-border">
                                    <td className="px-2 py-1.5">{occurrence.source_occurrence_id}</td>
                                    <td className="px-2 py-1.5">{occurrence.invoice_number}</td>
                                    <td className="px-2 py-1.5">{occurrence.customer_name || '-'}</td>
                                    <td className="px-2 py-1.5">{APPROVAL_LABELS[occurrence.approval_status]}</td>
                                    <td className="px-2 py-1.5">{occurrence.items_count}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                        {(importPreview.warnings_count || importPreview.errors_count) ? (
                          <div className="rounded-md border semantic-panel-warning px-3 py-2 text-sm">
                            <strong>{importPreview.errors_count || 0} erro(s) e {importPreview.warnings_count || 0} alerta(s).</strong>
                            <button type="button" onClick={downloadIssues} className="ml-2 underline">Baixar relatório</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-md border semantic-panel-success px-3 py-2 text-sm">
                            <CheckCircle2 size={16} /> Nenhum problema de qualidade encontrado.
                          </div>
                        )}
                        {Boolean(importPreview.other_carriers?.length) ? (
                          <div className="flex gap-2 rounded-md border semantic-panel-warning px-3 py-2 text-sm">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            Transportadoras diferentes sinalizadas: {importPreview.other_carriers?.join(', ')}
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={importing || !importPreview.total_occurrences} onClick={() => void handleConfirmImport()} className="h-10 rounded-md bg-success px-4 text-sm font-semibold text-white disabled:opacity-45">
                            {importing ? 'Importando...' : 'Confirmar importação'}
                          </button>
                          <button type="button" disabled={importing} onClick={() => { setImportPreview(null); setSelectedFile(null); }} className="h-10 rounded-md border border-border px-4 text-sm font-semibold text-muted">
                            Cancelar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </section>

              <section className="rounded-lg border border-border bg-card p-4 shadow-soft">
                <h2 className="text-base font-bold text-text">Histórico de importações</h2>
                {!imports.length ? (
                  <p className="mt-4 text-sm text-muted">Nenhuma importação confirmada.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {imports.map((item) => (
                      <article key={item.id} className="rounded-md border border-border bg-surface p-3 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <strong className="break-all text-sm text-text">{item.original_file_name}</strong>
                          <span className="rounded-full semantic-panel-success px-2 py-0.5 font-semibold">Confirmada</span>
                        </div>
                        <p className="mt-1 text-muted">{formatDateTime(item.imported_at)} · {item.imported_by_username || 'Usuário não informado'}</p>
                        <p className="mt-2 text-muted">
                          {item.total_occurrences} ocorrência(s) · {item.created_occurrences} nova(s) · {item.updated_occurrences} atualizada(s) · {item.unchanged_occurrences} ignorada(s)
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </section>
      </Container>
    </div>
  );
}

export default ReturnDataRegistry;
