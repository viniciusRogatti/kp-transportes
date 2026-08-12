import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileInput,
  FileText,
  History,
  MapPinned,
  PackageOpen,
  Printer,
  RefreshCcw,
  Route,
  Search,
  Truck,
  UserRound,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Container } from '../style/invoices';
import { getInvoiceJourney } from '../services/invoiceJourneyService';
import {
  IInvoiceJourney,
  IInvoiceJourneyEvent,
  InvoiceJourneyCategory,
} from '../types/types';
import {
  filterJourneyEvents,
  formatJourneyDuration,
  getJourneyActorLabel,
  JOURNEY_CATEGORY_LABELS,
} from '../utils/invoiceJourney';
import { cn } from '../lib/cn';
import verifyToken from '../utils/verifyToken';
import { formatDateBR, formatDateTimeBR } from '../utils/dateDisplay';

type JourneyFilter = 'all' | InvoiceJourneyCategory;

const CATEGORY_ICONS = {
  import: FileInput,
  routing: Route,
  delivery: Truck,
  receipt: FileCheck2,
  occurrence: ClipboardList,
  return: PackageOpen,
  alert: AlertTriangle,
  document: FileText,
};

const TONE_CLASS_NAMES: Record<IInvoiceJourneyEvent['tone'], string> = {
  neutral: 'border-border bg-surface-2 text-muted',
  info: 'border-info/45 bg-info/10 text-info',
  success: 'border-success/45 bg-success/10 text-success',
  warning: 'border-warning/45 bg-warning/10 text-warning',
  danger: 'border-danger/45 bg-danger/10 text-danger',
};

const FILTERS = Object.keys(JOURNEY_CATEGORY_LABELS) as JourneyFilter[];

function formatDateTime(value: string | null) {
  return formatDateTimeBR(value, 'Não registrado');
}

function formatCurrency(value: number | null) {
  if (value === null) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getEventDetails(event: IInvoiceJourneyEvent) {
  const metadata = event.metadata || {};
  const details = [
    metadata.tripId ? `Rota #${metadata.tripId}` : null,
    metadata.runNumber ? `Saída ${metadata.runNumber}` : null,
    metadata.sequence ? `Parada ${metadata.sequence}` : null,
    metadata.driverName ? `Motorista: ${metadata.driverName}` : null,
    metadata.vehicle ? `Veículo: ${metadata.vehicle}` : null,
    metadata.batchCode ? `Lote: ${metadata.batchCode}` : null,
    metadata.replacementInvoiceNumber ? `NF nova: ${metadata.replacementInvoiceNumber}` : null,
    metadata.number ? `Número: ${metadata.number}` : null,
  ];
  return details.filter(Boolean) as string[];
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  const compactValue = typeof value === 'string' && value.length > 10;

  return (
    <Card className="min-w-0 p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={cn('mt-1 whitespace-nowrap font-bold leading-tight text-text', compactValue ? 'text-base' : 'text-xl')}>{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted" title={detail}>{detail}</p>
    </Card>
  );
}

function InvoiceJourney() {
  const navigate = useNavigate();
  const { invoiceNumber = '' } = useParams();
  const [searchParams] = useSearchParams();
  const companyIdParam = Number(searchParams.get('companyId') || 0);
  const companyId = Number.isFinite(companyIdParam) && companyIdParam > 0 ? companyIdParam : null;
  const [journey, setJourney] = useState<IInvoiceJourney | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<JourneyFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.classList.add('invoice-journey-document');
    return () => document.body.classList.remove('invoice-journey-document');
  }, []);

  const loadJourney = useCallback(async () => {
    if (!invoiceNumber) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getInvoiceJourney(invoiceNumber, companyId);
      setJourney(data);
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.error
        || requestError?.message
        || 'Não foi possível carregar a jornada desta NF.',
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, invoiceNumber]);

  useEffect(() => {
    const validateSession = async () => {
      const token = localStorage.getItem('token');
      if (!token || !(await verifyToken(token))) {
        navigate('/');
        return;
      }
      await loadJourney();
    };
    void validateSession();
  }, [loadJourney, navigate]);

  const visibleEvents = useMemo(
    () => filterJourneyEvents(journey?.events || [], activeFilter),
    [activeFilter, journey?.events],
  );

  const goBackToInvoice = () => {
    const params = new URLSearchParams({ nf: invoiceNumber });
    navigate(`/invoices?${params.toString()}`);
  };

  const printJourney = () => {
    const previousTitle = document.title;
    document.title = `Jornada NF ${invoiceNumber} - KP Transportes`;
    window.addEventListener('afterprint', () => {
      document.title = previousTitle;
    }, { once: true });
    window.print();
  };

  const openSearchedJourney = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedInvoice = invoiceSearch.trim().replace(/^(?:nf[\s.#-]*)/i, '');
    if (!normalizedInvoice) return;
    navigate(`/invoices/${encodeURIComponent(normalizedInvoice)}/journey`);
  };

  return (
    <div className="invoice-journey-page">
      <Header />
      <Container className="items-stretch">
        <main className="mx-auto w-full max-w-[1240px] print:max-w-none">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <Button tone="outline" onClick={goBackToInvoice} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar para a NF
            </Button>
            <div className="flex gap-2">
              <Button tone="secondary" onClick={() => void loadJourney()} disabled={loading} className="gap-2">
                <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
                Atualizar
              </Button>
              <Button onClick={printJourney} disabled={!journey} className="gap-2">
                <Printer className="h-4 w-4" />
                Imprimir jornada
              </Button>
            </div>
          </div>

          {loading ? (
            <Card className="flex min-h-[320px] items-center justify-center text-sm font-semibold text-muted">
              <RefreshCcw className="mr-2 h-5 w-5 animate-spin" />
              Montando a jornada da NF...
            </Card>
          ) : error ? (
            <Card className="border-danger/40">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                <div>
                  <h1 className="font-semibold text-text">Jornada indisponível</h1>
                  <p className="mt-1 text-sm text-muted">{error}</p>
                  <Button className="mt-4" onClick={() => void loadJourney()}>Tentar novamente</Button>
                </div>
              </div>
            </Card>
          ) : !invoiceNumber ? (
            <Card className="mx-auto max-w-[720px] overflow-hidden p-0">
              <div className="border-b border-border bg-surface-2 px-5 py-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-accent">
                  <History className="h-4 w-4" />
                  Consulta operacional
                </div>
                <h1 className="mt-2 text-2xl font-bold text-text">Jornada da Nota Fiscal</h1>
                <p className="mt-2 max-w-[580px] text-sm leading-relaxed text-muted">
                  Consulte toda a história logística da NF, desde a importação do XML até a entrega,
                  incluindo rotas, reentregas, devoluções, ocorrências, alertas e canhotos.
                </p>
              </div>
              <form onSubmit={openSearchedJourney} className="p-5">
                <label htmlFor="journey-invoice-search" className="text-sm font-semibold text-text">
                  Número da nota fiscal
                </label>
                <div className="mt-2 flex gap-2 max-[560px]:flex-col">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      id="journey-invoice-search"
                      value={invoiceSearch}
                      onChange={(event) => setInvoiceSearch(event.target.value)}
                      placeholder="Ex.: 1817267"
                      autoFocus
                      className="h-11 w-full rounded-md border border-border bg-card pl-10 pr-3 text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                  <Button type="submit" disabled={!invoiceSearch.trim()} className="h-11 gap-2">
                    <Search className="h-4 w-4" />
                    Consultar jornada
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted">
                  Você também pode abrir a jornada pelo botão disponível em cada card de NF.
                </p>
              </form>
            </Card>
          ) : journey ? (
            <>
              <Card className="journey-summary mt-0 overflow-hidden border-accent/30 p-0 print:mt-3">
                <div className="border-b border-border bg-surface-2 px-5 py-4">
                  <div>
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-accent">
                        <History className="h-4 w-4" />
                        Jornada logística
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold text-text">{`NF ${journey.invoice.invoiceNumber}`}</h1>
                        <Badge tone={journey.currentState.hasReceipt ? 'success' : 'warning'}>
                          {journey.currentState.statusLabel}
                        </Badge>
                        <span className="inline-flex h-6 items-center rounded-full border border-border bg-card px-2.5 text-xs font-semibold text-muted">
                          {`Empresa · ${journey.invoice.companyName || journey.invoice.companyCode || `#${journey.invoice.companyId}`}`}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {journey.invoice.customer.name || 'Cliente não registrado'}
                        {journey.invoice.customer.city ? ` · ${journey.invoice.customer.city}/${journey.invoice.customer.state || '-'}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="journey-invoice-facts grid gap-3 px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-8">
                  <div><span className="text-muted">Emissão</span><p className="font-semibold text-text">{formatDateBR(journey.invoice.invoiceDate || '') || '-'}</p></div>
                  <div><span className="text-muted">Carga</span><p className="font-semibold text-text">{journey.invoice.loadNumber || '-'}</p></div>
                  <div><span className="text-muted">Valor</span><p className="font-semibold text-text">{formatCurrency(journey.invoice.totalValue)}</p></div>
                  <div><span className="text-muted">Importação</span><p className="font-semibold text-text">{formatDateTime(journey.invoice.importedAt)}</p></div>
                  <div className="hidden print:block"><span className="text-muted">Rota atual</span><p className="font-semibold text-text">{journey.currentState.tripId ? `#${journey.currentState.tripId}` : 'Sem rota'}</p></div>
                  <div className="hidden print:block"><span className="text-muted">Motorista</span><p className="font-semibold text-text">{journey.currentState.driver?.name || 'Não atribuído'}</p></div>
                  <div className="hidden print:block"><span className="text-muted">Veículo</span><p className="font-semibold text-text">{journey.currentState.vehicle?.licensePlate || 'Não atribuído'}</p></div>
                  <div className="hidden print:block"><span className="text-muted">Canhoto</span><p className="font-semibold text-text">{journey.currentState.hasReceipt ? 'Recebido' : 'Pendente'}</p></div>
                </div>
              </Card>

              <section className="journey-metrics mt-3 grid grid-cols-2 items-start gap-2 md:grid-cols-4 lg:grid-cols-7 print:grid-cols-7">
                <MetricCard label="Eventos" value={journey.summary.totalEvents} detail="registros encontrados" />
                <MetricCard label="Rotas" value={journey.summary.routes} detail="atribuições históricas" />
                <MetricCard label="Reentregas" value={journey.summary.redeliveries} detail="tentativas registradas" />
                <MetricCard label="Devoluções" value={journey.summary.returns} detail="movimentações" />
                <MetricCard label="Ocorrências" value={journey.summary.occurrences} detail={`${journey.currentState.openOccurrences} aberta(s)`} />
                <MetricCard label="Canhotos" value={journey.summary.receipts} detail={journey.currentState.hasReceipt ? 'com comprovante' : 'sem comprovante'} />
                <MetricCard label="Tempo total" value={formatJourneyDuration(journey.summary.durationHours)} detail={journey.summary.completedAt ? 'até a conclusão' : 'jornada em andamento'} />
              </section>

              <section className="journey-content-grid mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <Card className="journey-timeline min-w-0">
                  <div className="border-b border-border pb-3">
                    <div>
                      <h2 className="text-lg font-bold text-text">Linha do tempo</h2>
                      <p className="text-sm text-muted">{`${visibleEvents.length} evento(s) exibido(s)`}</p>
                    </div>
                    <div className="mt-3 flex flex-nowrap gap-1 overflow-x-auto pb-1 print:hidden">
                      {FILTERS.map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setActiveFilter(filter)}
                          aria-pressed={activeFilter === filter}
                          className={cn(
                            'shrink-0 rounded-md border px-2 py-1 text-xs font-semibold transition',
                            activeFilter === filter
                              ? 'border-accent bg-accent text-white'
                              : 'border-border bg-surface-2 text-muted hover:border-accent/50 hover:text-text',
                          )}
                        >
                          {JOURNEY_CATEGORY_LABELS[filter]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {visibleEvents.length ? (
                    <ol className="relative mt-5 space-y-1">
                      {visibleEvents.map((event, index) => {
                        const Icon = CATEGORY_ICONS[event.category] || Clock3;
                        const details = getEventDetails(event);
                        return (
                          <li key={event.id} className="journey-event relative grid grid-cols-[38px_minmax(0,1fr)] gap-3 pb-6">
                            {index < visibleEvents.length - 1 ? (
                              <span className="absolute bottom-0 left-[18px] top-9 w-px bg-border" aria-hidden="true" />
                            ) : null}
                            <span className={cn('relative z-10 grid h-9 w-9 place-items-center rounded-full border', TONE_CLASS_NAMES[event.tone])}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <article className="min-w-0 rounded-md border border-border bg-surface-2 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <h3 className="font-semibold text-text">{event.title}</h3>
                                  <p className="mt-0.5 text-xs text-muted">{formatDateTime(event.occurredAt)}</p>
                                </div>
                                <Badge tone={event.tone === 'neutral' ? 'neutral' : event.tone}>
                                  {JOURNEY_CATEGORY_LABELS[event.category]}
                                </Badge>
                              </div>
                              {event.description ? <p className="mt-2 text-sm text-muted">{event.description}</p> : null}
                              {details.length ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {details.map((detail) => (
                                    <span key={detail} className="rounded border border-border bg-card px-2 py-1 text-[11px] text-text">
                                      {detail}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                                <UserRound className="h-3.5 w-3.5" />
                                {getJourneyActorLabel(event.actor)}
                              </div>
                            </article>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <div className="py-12 text-center text-sm text-muted">Nenhum evento nesta categoria.</div>
                  )}
                </Card>

                <aside className="journey-aside space-y-4">
                  <Card>
                    <div className="flex items-center gap-2">
                      <MapPinned className="h-5 w-5 text-text-accent" />
                      <h2 className="font-bold text-text">Situação atual</h2>
                    </div>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div><dt className="text-muted">Status</dt><dd className="font-semibold text-text">{journey.currentState.statusLabel}</dd></div>
                      <div><dt className="text-muted">Rota atual</dt><dd className="font-semibold text-text">{journey.currentState.tripId ? `#${journey.currentState.tripId}` : 'Sem rota'}</dd></div>
                      <div><dt className="text-muted">Motorista</dt><dd className="font-semibold text-text">{journey.currentState.driver?.name || 'Não atribuído'}</dd></div>
                      <div><dt className="text-muted">Veículo</dt><dd className="font-semibold text-text">{journey.currentState.vehicle?.licensePlate || 'Não atribuído'}</dd></div>
                      <div><dt className="text-muted">Canhoto</dt><dd className="font-semibold text-text">{journey.currentState.hasReceipt ? 'Recebido' : 'Pendente'}</dd></div>
                    </dl>
                  </Card>

                  {journey.invoice.replacementInvoiceNumber ? (
                    <Card className="border-warning/40">
                      <div className="flex gap-2">
                        <FileText className="h-5 w-5 shrink-0 text-warning" />
                        <div>
                          <h2 className="font-bold text-text">Refaturamento</h2>
                          <p className="mt-1 text-sm text-muted">{`Substituída pela NF ${journey.invoice.replacementInvoiceNumber}`}</p>
                          {journey.invoice.replacementReason ? <p className="mt-1 text-xs text-muted">{journey.invoice.replacementReason}</p> : null}
                        </div>
                      </div>
                    </Card>
                  ) : null}

                  <Card className="border-info/30">
                    <div className="flex gap-2">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-info" />
                      <div>
                        <h2 className="font-bold text-text">Cobertura histórica</h2>
                        <p className="mt-1 text-xs leading-relaxed text-muted">{journey.coverage.note}</p>
                      </div>
                    </div>
                  </Card>
                </aside>
              </section>
            </>
          ) : null}
        </main>
      </Container>
    </div>
  );
}

export default InvoiceJourney;
