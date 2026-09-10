import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { IDanfe, IInvoiceSearchContext, IGroupedProduct } from "../types/types";
import axios from "axios";
import CardDanfes from "../components/CardDanfes";
import DanfeStatusLegend from "../components/DanfeStatusLegend";
import { API_URL } from "../data";
import Header from "../components/Header";
import ScrollToTopButton from "../components/ScrollToTopButton";
import CompanyTabs from "../components/CompanyTabs";
import { Container } from "../style/invoices";
import InvoiceFilters from '../components/invoices/InvoiceFilters';
import RouteOverview from '../components/invoices/RouteOverview';
import useRouteCatalog from '../hooks/useRouteCatalog';
import { normalizeRouteCity, routeByCity, RouteSummary } from '../utils/routeCatalog';
import { buildInvoiceContextKey } from '../utils/invoiceContextKey';
import { useNavigate } from "react-router";
import verifyToken from "../utils/verifyToken";
import { useSearchParams } from "react-router-dom";
import { createEmptyInvoiceListFilters, filterInvoiceListDanfes } from "../utils/danfeFilters";
import { sanitizeDanfeTextFields } from "../utils/textNormalization";
import useInvoiceSearchContext from "../hooks/useInvoiceSearchContext";
import TodayProductList from "../components/TodayProductList";
import { groupTodayInvoiceProducts } from "../utils/todayInvoiceProducts";
import { pdf } from "@react-pdf/renderer";
import { COMPANY_LABELS, resolveDanfeCompanyCode } from "../utils/companyTabs";
import InvoiceSearchPanel, { InvoiceSearchFeedback } from "../components/InvoiceSearchPanel";
import { withRequestReference } from "../utils/requestError";
const INITIAL_RENDER_LIMIT = 60;
const PERIOD_PAGE_SIZE = 120;

type PeriodSearchState = {
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

type PeriodSearchResponse = {
  contexts: Record<string, IInvoiceSearchContext>;
  routeSummary: RouteSummary[];
  filterOptions?: { cities: string[]; drivers: string[]; loads: string[] };
  rows: IDanfe[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

function mergeDanfes(currentRows: IDanfe[], incomingRows: IDanfe[]) {
  const rowsByKey = new Map<string, IDanfe>();
  [...currentRows, ...incomingRows].forEach((danfe) => {
    rowsByKey.set(`${Number(danfe.company_id || 0)}::${String(danfe.invoice_number)}`, danfe);
  });
  return Array.from(rowsByKey.values());
}

function Invoices() {
  const [dataDanfes, setDataDanfes] = useState<IDanfe[]>([]);
  const {
    invoiceContextByNf,
    driverLoadingByInvoice,
    driverErrorByInvoice,
    loadInvoiceContext,
    refreshInvoiceContext,
    seedInvoiceContext,
  } = useInvoiceSearchContext();
  const [searchNf, setSearchNf] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [filters, setFilters] = useState(createEmptyInvoiceListFilters);
  const [activeCompanyTab, setActiveCompanyTab] = useState<string>('all');
  const [isPrinting, setIsPrinting] = useState(false);
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_LIMIT);
  const [isSearchingPeriod, setIsSearchingPeriod] = useState(false);
  const [isLoadingMorePeriod, setIsLoadingMorePeriod] = useState(false);
  const [periodSearch, setPeriodSearch] = useState<PeriodSearchState | null>(null);
  const [periodRange, setPeriodRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [periodSummary, setPeriodSummary] = useState<RouteSummary[]>([]);
  const [periodOptions, setPeriodOptions] = useState({ cities: [] as string[], drivers: [] as string[], loads: [] as string[] });
  const periodOptionsKey = useRef('');
  const periodController = useRef<AbortController | null>(null);
  const [periodSearchError, setPeriodSearchError] = useState<string | null>(null);
  const [isSearchingInvoice, setIsSearchingInvoice] = useState(false);
  const [invoiceSearchFeedback, setInvoiceSearchFeedback] = useState<InvoiceSearchFeedback | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const periodRequestIdRef = useRef(0);
  const deferredFilters = useDeferredValue(filters);
  const routeCatalog = useRouteCatalog();
  const routeMap = useMemo(() => routeByCity(routeCatalog.data?.routes || []), [routeCatalog.data]);
  const localCityOptions = useMemo(() => Array.from(new Map(dataDanfes
    .filter((danfe) => Boolean(danfe.Customer?.city))
    .map((danfe) => [normalizeRouteCity(danfe.Customer.city), danfe.Customer.city])).values())
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [dataDanfes]);
  const cityOptions = periodRange ? periodOptions.cities : localCityOptions;
  const canChangeInvoiceStatus = ['admin', 'master', 'user', 'expedicao'].includes(
    String(localStorage.getItem('user_permission') || '').trim().toLowerCase(),
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    const fetchToken = async () => {
      if (token) {
        const isValidToken = await verifyToken(token);
        if (!isValidToken) {
          navigate('/');
        }
      } else {
        navigate('/');
      }
    } 
    fetchToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  async function requestPeriodPage(
    range: { startDate: string; endDate: string }, page: number, append: boolean, requestId: number,
    signal?: AbortSignal,
  ) {
    const optionsKey = JSON.stringify([range.startDate, range.endDate, activeCompanyTab]);
    const { data } = await axios.post<PeriodSearchResponse>(`${API_URL}/danfes/search-period`, {
      ...range, page, pageSize: PERIOD_PAGE_SIZE,
      filters: { ...filters, companyCode: activeCompanyTab },
      includeOptions: periodOptionsKey.current !== optionsKey,
    }, { signal });
    if (requestId !== periodRequestIdRef.current) return;
    if (!Array.isArray(data?.rows) || !data.contexts || !Array.isArray(data.routeSummary)) {
      throw new Error('A resposta do período está incompleta. Atualize o backend antes de usar esta tela.');
    }
    const sanitizedRows = data.rows.map((danfe) => sanitizeDanfeTextFields(danfe));
    seedInvoiceContext(data.contexts);
    setDataDanfes((currentRows) => append ? mergeDanfes(currentRows, sanitizedRows) : sanitizedRows);
    setPeriodSearch({ ...range, page: data.page, pageSize: data.pageSize, total: data.total, hasMore: data.hasMore });
    setPeriodSummary(data.routeSummary);
    if (data.filterOptions) { setPeriodOptions(data.filterOptions); periodOptionsKey.current = optionsKey; }
    if (!append) setRenderLimit(INITIAL_RENDER_LIMIT);
  }

  function getDanfesByDate() {
    if (!startDate || !endDate) { setPeriodSearchError('Selecione a data inicial e a data final.'); return; }
    const from = formatDate(startDate) as string, to = formatDate(endDate) as string;
    if (from > to) { setPeriodSearchError('A data inicial não pode ser posterior à data final.'); return; }
    periodOptionsKey.current = '';
    setPeriodRange({ startDate: from, endDate: to });
    setStartDate(null); setEndDate(null);
  }

  // Filter the entire period on the server, while keeping only requested pages
  // in the browser. Cancel obsolete requests and debounce typing.
  const periodFilterKey = JSON.stringify([filters, activeCompanyTab, routeCatalog.data?.version]);
  useEffect(() => {
    if (!periodRange) return;
    const requestId = ++periodRequestIdRef.current;
    const controller = new AbortController();
    periodController.current = controller;
    setIsSearchingPeriod(true); setIsLoadingMorePeriod(false); setPeriodSearchError(null);
    setDataDanfes([]); setPeriodSummary([]); setPeriodSearch(null);
    const timer = setTimeout(() => {
      void requestPeriodPage(periodRange, 1, false, requestId, controller.signal).catch((error) => {
        if (requestId !== periodRequestIdRef.current || controller.signal.aborted) return;
        setPeriodSearchError(withRequestReference('Não foi possível carregar o período com todos os dados. Tente novamente.', error));
      }).finally(() => {
        if (requestId === periodRequestIdRef.current) setIsSearchingPeriod(false);
      });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
    // requestPeriodPage uses exactly the filter snapshot represented by this key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodRange, periodFilterKey]);

  async function loadMorePeriodDanfes() {
    if (!periodSearch?.hasMore || isLoadingMorePeriod || isSearchingPeriod || !periodRange) return;
    const requestId = periodRequestIdRef.current;
    setIsLoadingMorePeriod(true); setPeriodSearchError(null);
    try {
      await requestPeriodPage(periodRange, periodSearch.page + 1, true, requestId, periodController.current?.signal);
    } catch (error) {
      if (requestId !== periodRequestIdRef.current) return;
      setPeriodSearchError(withRequestReference('Não foi possível carregar a próxima página com todos os dados. Tente novamente.', error));
    } finally {
      if (requestId === periodRequestIdRef.current) setIsLoadingMorePeriod(false);
    }
  }

  async function findMissingInvoiceReference(invoiceNumber: string) {
    const { data } = await axios.get(
      `${API_URL}/danfes/nf/${encodeURIComponent(invoiceNumber)}/references`,
      { params: activeCompanyTab !== 'all' ? { companyCode: activeCompanyTab } : undefined },
    );
    const references = Array.isArray(data?.references) ? data.references : [];
    if (!references.length) return null;

    const reference = references[0];
    const companyCode = String(reference.company?.code || '').trim().toLowerCase();
    const companyName = COMPANY_LABELS[companyCode] || reference.company?.name || 'empresa não identificada';
    const batchCode = String(reference.batch_code || '').trim();
    return {
      tone: 'warning' as const,
      message: `A NF ${reference.invoice_number || invoiceNumber} não está no cadastro principal, mas existe no lote ${batchCode || 'identificado'} da ${companyName}. Reimporte o XML da NF para restaurar os dados sem perder o vínculo da devolução.`,
      actionUrl: batchCode
        ? `/returns-occurrences?tab=returns&nf=${encodeURIComponent(reference.invoice_number || invoiceNumber)}&batch=${encodeURIComponent(batchCode)}`
        : `/returns-occurrences?tab=returns&nf=${encodeURIComponent(reference.invoice_number || invoiceNumber)}`,
      actionLabel: 'Abrir lote de devolução',
    };
  }

  async function getDanfeByNf () {
    const normalizedNf = searchNf.trim().replace(/^(?:nf[\s.#-]*)/i, '');
    if (!normalizedNf) return;

    setIsSearchingInvoice(true);
    periodRequestIdRef.current += 1;
    setIsSearchingPeriod(false);
    setIsLoadingMorePeriod(false);
    setPeriodSearch(null);
    setPeriodRange(null);
    setPeriodSearchError(null);
    setInvoiceSearchFeedback(null);
    try {
      let { data } = await axios.get(`${API_URL}/danfes/nf/${encodeURIComponent(normalizedNf)}`, {
        params: activeCompanyTab !== 'all' ? { companyCode: activeCompanyTab } : undefined,
      });
      let foundOutsideSelectedCompany = false;

      if (!data && activeCompanyTab !== 'all') {
        const fallbackResponse = await axios.get(`${API_URL}/danfes/nf/${encodeURIComponent(normalizedNf)}`);
        data = fallbackResponse.data;
        foundOutsideSelectedCompany = Boolean(data);
      }

      if (data) {
        const sanitizedDanfe = sanitizeDanfeTextFields(data);
        if (foundOutsideSelectedCompany) {
          const resolvedCompanyCode = resolveDanfeCompanyCode(sanitizedDanfe);
          setActiveCompanyTab(COMPANY_LABELS[resolvedCompanyCode] ? resolvedCompanyCode : 'all');
          setInvoiceSearchFeedback({
            tone: 'info',
            message: `A NF ${sanitizedDanfe.invoice_number} estava em outra empresa e foi localizada em ${COMPANY_LABELS[resolvedCompanyCode] || sanitizedDanfe.company?.name || 'Todas'}.`,
          });
        }
        await loadInvoiceContext([sanitizedDanfe], {
          force: true,
          includeTripDriver: true,
        });
        setDataDanfes((previous) => {
          const invoiceNumber = String(sanitizedDanfe.invoice_number);
          const nextRows = previous.filter((danfe) => buildInvoiceContextKey(danfe.company_id, danfe.invoice_number) !== buildInvoiceContextKey(sanitizedDanfe.company_id, invoiceNumber));
          return [sanitizedDanfe, ...nextRows];
        });
        setSearchNf('');
      } else {
        const orphanFeedback = await findMissingInvoiceReference(normalizedNf);
        setInvoiceSearchFeedback(orphanFeedback || {
          tone: 'danger',
          message: `A NF ${normalizedNf} não foi encontrada. Verifique se o XML foi importado ou se o número foi digitado corretamente.`,
        });
      }
    } catch (error) {
      console.error('Algo deu errado ao tentar buscar essa nf', error);
      const apiMessage = axios.isAxiosError(error)
        ? String(error.response?.data?.error || error.response?.data?.message || '').trim()
        : '';
      setInvoiceSearchFeedback({
        tone: 'danger',
        message: withRequestReference(
          apiMessage || `Não foi possível consultar a NF ${normalizedNf} agora. Tente novamente.`,
          error,
        ),
      });
    } finally {
      setIsSearchingInvoice(false);
    }
  };

  useEffect(() => {
    const queryNf = searchParams.get('nf')?.trim();
    if (!queryNf) return;

    setSearchNf(queryNf);
    setInvoiceSearchFeedback(null);

    const fetchQueryNf = async () => {
      periodRequestIdRef.current += 1;
      setIsSearchingPeriod(false);
      setIsLoadingMorePeriod(false);
      setPeriodSearch(null);
      setPeriodRange(null);
      setPeriodSearchError(null);
      try {
        const { data } = await axios.get(`${API_URL}/danfes/nf/${encodeURIComponent(queryNf)}`, {
          params: activeCompanyTab !== 'all' ? { companyCode: activeCompanyTab } : undefined,
        });
        if (!data) {
          const orphanFeedback = await findMissingInvoiceReference(queryNf);
          setInvoiceSearchFeedback(orphanFeedback || {
            tone: 'danger',
            message: `A NF ${queryNf} não foi encontrada. Verifique se o XML foi importado.`,
          });
          return;
        }
        const sanitizedDanfe = sanitizeDanfeTextFields(data);
        setDataDanfes([sanitizedDanfe]);
        await loadInvoiceContext([sanitizedDanfe], { force: true, includeTripDriver: true });
      } catch (error) {
        console.error('Algo deu errado ao tentar buscar essa nf', error);
        setInvoiceSearchFeedback({
          tone: 'danger',
          message: withRequestReference(`Não foi possível consultar a NF ${queryNf} agora.`, error),
        });
      }
    };

    fetchQueryNf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!dataDanfes.length) return undefined;

    const refreshVisibleInvoiceContext = () => {
      if (periodRange) { periodOptionsKey.current = ''; setPeriodRange((current) => current ? { ...current } : null); }
      else void refreshInvoiceContext(dataDanfes, { includeTripDriver: true });
    };

    const handleWindowFocus = () => {
      refreshVisibleInvoiceContext();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshVisibleInvoiceContext();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dataDanfes, refreshInvoiceContext, periodRange]);

  function formatDate(date: Date | null) {
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }


  function clearFilter(key: keyof typeof filters) {
    setFilters((previous) => ({
      ...previous,
      [key]: ['route', 'city', 'driver', 'loadNumbers'].includes(key) ? [] : '',
    }));
  }

  function clearLoadFilter(load: string) {
    setFilters((previous) => ({
      ...previous,
      loadNumbers: previous.loadNumbers.filter((item) => item !== load),
    }));
  }

  function resetFilters() {
    setFilters(createEmptyInvoiceListFilters());
  }

  const localDriverOptions = useMemo(
    () => Array.from(
      new Set(
        Object.values(invoiceContextByNf)
          .map((context) => String(context.driver_name || '').trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })),
    [invoiceContextByNf],
  );

  const visibleDanfes = useMemo(() => {
    if (activeCompanyTab === 'all') return dataDanfes;
    return dataDanfes.filter((danfe) => resolveDanfeCompanyCode(danfe) === activeCompanyTab);
  }, [activeCompanyTab, dataDanfes]);

  const localLoadOptions = useMemo(
    () => Array.from(
      new Set(
        visibleDanfes
          .map((danfe) => String(danfe.load_number || '').trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })),
    [visibleDanfes],
  );

  const driverOptions = periodRange ? periodOptions.drivers : localDriverOptions;
  const loadOptions = periodRange ? periodOptions.loads : localLoadOptions;

  const activeFilters = useMemo(() => {
    const entries: Array<{ key: keyof typeof filters; label: string }> = [];
    if (filters.nf.trim()) entries.push({ key: 'nf', label: `NF: ${filters.nf.trim()}` });
    if (filters.product.trim()) entries.push({ key: 'product', label: `Produto: ${filters.product.trim()}` });
    if (filters.customer.trim()) entries.push({ key: 'customer', label: `Cliente: ${filters.customer.trim()}` });
    if (filters.city.join(', ')) entries.push({ key: 'city', label: `Cidade: ${filters.city.join(', ')}` });
    if (filters.route.length > 0) entries.push({ key: 'route', label: `Rota: ${filters.route.map((id) => routeCatalog.data?.routes.find((route) => route.id === id)?.name || 'Sem rota definida').join(', ')}` });
    if (filters.driver.join(', ')) entries.push({ key: 'driver', label: `Motorista: ${filters.driver.join(', ')}` });
    if (filters.status) entries.push({ key: 'status', label: `Status: ${filters.status}` });
    if (activeCompanyTab !== 'all') entries.push({ key: 'status', label: `Empresa: ${COMPANY_LABELS[activeCompanyTab] || activeCompanyTab}` });
    return entries;
  }, [activeCompanyTab, filters, routeCatalog.data]);

  const danfes = useMemo(
    () => periodRange ? visibleDanfes : filterInvoiceListDanfes(visibleDanfes, deferredFilters, { invoiceContextByNf, routeByCity: routeMap }),
    [visibleDanfes, deferredFilters, invoiceContextByNf, routeMap, periodRange],
  );
  const renderedDanfes = useMemo(() => danfes.slice(0, renderLimit), [danfes, renderLimit]);

  useEffect(() => {
    setRenderLimit(INITIAL_RENDER_LIMIT);
  }, [activeCompanyTab, deferredFilters, dataDanfes]);

  async function openPDFInNewTab() {
    if (isSearchingPeriod || isPrinting || periodSearchError) return;
    setIsPrinting(true);
    const preview = window.open('', '_blank');
    try {
      const products: IGroupedProduct[] = periodRange
        ? (await axios.post(`${API_URL}/danfes/search-products`, { ...periodRange, filters: { ...filters, companyCode: activeCompanyTab } })).data
        : groupTodayInvoiceProducts(filterInvoiceListDanfes(visibleDanfes, filters, { invoiceContextByNf, routeByCity: routeMap }));
      if (!products.length) { preview?.close(); return; }
      const blob = await pdf(<TodayProductList products={products} />).toBlob();
      const url = URL.createObjectURL(blob);
      if (preview) preview.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      preview?.close();
      setInvoiceSearchFeedback({ tone: 'danger', message: withRequestReference('Não foi possível gerar a lista completa de produtos. Tente novamente.', error) });
    } finally { setIsPrinting(false); }
  }

  function handleDanfeUpdated(updatedDanfe: IDanfe) {
    setDataDanfes((previous) => {
      const invoiceNumber = String(updatedDanfe.invoice_number);
      const nextRows = previous.filter((danfe) => buildInvoiceContextKey(danfe.company_id, danfe.invoice_number) !== buildInvoiceContextKey(updatedDanfe.company_id, invoiceNumber));
      return [sanitizeDanfeTextFields(updatedDanfe), ...nextRows];
    });
    if (periodRange) setPeriodRange((current) => current ? { ...current } : null);
    else void loadInvoiceContext([updatedDanfe], { force: true, includeTripDriver: true });
  }
  
  return (
    <div>
      <Header />
      <Container>
        <CompanyTabs activeTab={activeCompanyTab} onChange={setActiveCompanyTab} />
        <InvoiceSearchPanel
          searchNf={searchNf}
          onSearchNfChange={setSearchNf}
          onSearchNf={getDanfeByNf}
          isSearchingInvoice={isSearchingInvoice}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onSearchPeriod={getDanfesByDate}
          isSearchingPeriod={isSearchingPeriod}
          invoiceSearchFeedback={invoiceSearchFeedback}
          periodSearchError={periodSearchError}
          onNavigate={navigate}
        />

        <section
          aria-labelledby="invoice-filter-title"
          className="mb-3 w-full max-w-[var(--content-max-width)] rounded-lg border border-border bg-surface p-3 [&_input]:h-9 [&_select]:h-9"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 id="invoice-filter-title" className="text-base font-semibold text-text">Refinar resultados</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-text transition-colors hover:bg-surface-2"
              >
                Limpar filtros
              </button>
              {danfes.length > 0 ? (
                <button
                  type="button"
                  onClick={openPDFInNewTab}
                  disabled={isPrinting || isSearchingPeriod || Boolean(periodSearchError)}
                  className="rounded-md border border-accent-strong bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPrinting ? 'Gerando lista...' : 'Abrir lista de produtos'}
                </button>
              ) : null}
            </div>
          </div>

          <InvoiceFilters filters={filters} setFilters={setFilters} cities={cityOptions} drivers={driverOptions} loads={loadOptions} routes={routeCatalog.data?.routes || []} />
        </section>
        <details className="mb-2 w-full rounded-lg border border-border bg-surface [&_section]:mb-0 [&_section]:border-0">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text">Prévia de carga por rota <span className="ml-2 text-xs font-normal text-muted">Expandir para consultar</span></summary>
          <RouteOverview danfes={danfes} availableCities={cityOptions} catalog={routeCatalog} summary={periodRange ? periodSummary : undefined}
          onSelectRoute={(id) => setFilters((old) => ({ ...old, route: old.route.includes(id) ? old.route.filter((value) => value !== id) : [...old.route, id] }))} />
        </details>
        <DanfeStatusLegend
          activeStatusFilter={filters.status}
          onChange={(value) => updateFilter('status', value)}
          totalCount={visibleDanfes.length}
          filteredCount={danfes.length}
        />
        {activeFilters.length + filters.loadNumbers.length > 0 ? <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">
            {activeFilters.length + filters.loadNumbers.length} filtro(s) ativo(s)
          </span>
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-muted hover:text-text"
              onClick={() => clearFilter(filter.key)}
            >
              {filter.label} ×
            </button>
          ))}
          {filters.loadNumbers.map((load) => (
            <button
              key={load}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-muted hover:text-text"
              onClick={() => clearLoadFilter(load)}
            >
              {`Carga: ${load}`} ×
            </button>
          ))}
        </div> : null}
        {periodSearchError && periodRange ? <button type="button" className="mb-3 rounded border border-border px-3 py-2 text-text" onClick={() => setPeriodRange((current) => current ? { ...current } : null)}>Tentar consultar novamente</button> : null}
        <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-1 text-sm">
          <h2 className="font-semibold text-text">
            {periodSearch
              ? `${periodSearch.total} notas encontradas · ${dataDanfes.length} carregadas`
              : `${danfes.length} Notas encontradas`}
          </h2>
          <span className="text-muted">{activeCompanyTab === 'all'
            ? 'Exibindo notas de todas as empresas.'
            : `Exibindo apenas ${COMPANY_LABELS[activeCompanyTab] || activeCompanyTab}.`}</span>
        </div>
        <CardDanfes
          danfes={renderedDanfes}
          driverLoadingByInvoice={driverLoadingByInvoice}
          driverErrorByInvoice={driverErrorByInvoice}
          invoiceContextByNf={invoiceContextByNf}
          onDanfeUpdated={handleDanfeUpdated}
          allowStatusActions={canChangeInvoiceStatus}
          onOpenReturnBatch={(batchCode) => navigate(
            `/returns-occurrences?tab=returns&batch=${encodeURIComponent(batchCode)}`,
          )}
          showLegend={false}
        />
        {renderedDanfes.length < danfes.length ? (
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={() => setRenderLimit((current) => current + INITIAL_RENDER_LIMIT)}
              className="rounded-md border border-accent-strong bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
            >
              {`Mostrar mais 60 (${renderedDanfes.length} de ${danfes.length})`}
            </button>
          </div>
        ) : null}
        {periodSearch?.hasMore && renderedDanfes.length >= danfes.length ? (
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={() => void loadMorePeriodDanfes()}
              disabled={isLoadingMorePeriod || isSearchingPeriod}
              className="rounded-md border border-accent-strong bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMorePeriod || isSearchingPeriod
                ? 'Carregando mais notas...'
                : `Carregar mais notas (${dataDanfes.length} de ${periodSearch.total})`}
            </button>
          </div>
        ) : null}
        {isPrinting ? <div className="flex justify-center py-4"><span>Gerando lista de produtos...</span></div> : null}
        <ScrollToTopButton />
      </Container>
    </div>
  )
};

export default Invoices;
