import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { IDanfe } from "../types/types";
import axios from "axios";
import { Search } from "lucide-react";
import CardDanfes from "../components/CardDanfes";
import DanfeStatusLegend from "../components/DanfeStatusLegend";
import DatePicker, { registerLocale } from "react-datepicker";
import ptBR from 'date-fns/locale/pt-BR';
import { API_URL } from "../data";
import Header from "../components/Header";
import ScrollToTopButton from "../components/ScrollToTopButton";
import CompanyTabs from "../components/CompanyTabs";
import { Container } from "../style/invoices";
import { NotesFound } from "../style/TodayInvoices";
import { routes } from "../data/danfes";
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
registerLocale('ptBR', ptBR);

function Invoices() {
  const [dataDanfes, setDataDanfes] = useState<IDanfe[]>([]);
  const {
    invoiceContextByNf,
    driverLoadingByInvoice,
    driverErrorByInvoice,
    loadInvoiceContext,
    refreshInvoiceContext,
  } = useInvoiceSearchContext();
  const [searchNf, setSearchNf] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [filters, setFilters] = useState(createEmptyInvoiceListFilters);
  const [activeCompanyTab, setActiveCompanyTab] = useState<string>('all');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSearchingInvoice, setIsSearchingInvoice] = useState(false);
  const [invoiceSearchFeedback, setInvoiceSearchFeedback] = useState<{
    tone: 'danger' | 'info' | 'warning';
    message: string;
    actionUrl?: string;
    actionLabel?: string;
  } | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deferredFilters = useDeferredValue(filters);
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
  
  async function getDanfesByDate() {
    if (!startDate || !endDate ) {
      alert('Selecione duas datas');
    } else {
      try {
        const url = `${API_URL}/danfes/date/?startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}`;      
        const { data } = await axios.get(url);
        const sanitizedRows = Array.isArray(data)
          ? data.map((danfe: IDanfe) => sanitizeDanfeTextFields(danfe))
          : [];
        setStartDate(null);
        setEndDate(null);
        setDataDanfes(sanitizedRows);
        await refreshInvoiceContext(sanitizedRows, { includeTripDriver: true });
      } catch (error) {
        console.error('Não foi possível encontrar notas com essas datas', error);
      }
    }
  }

  function setFilter(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchNf(value)
  };

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
          const nextRows = previous.filter((danfe) => String(danfe.invoice_number) !== invoiceNumber);
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
        message: apiMessage || `Não foi possível consultar a NF ${normalizedNf} agora. Tente novamente.`,
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
          message: `Não foi possível consultar a NF ${queryNf} agora.`,
        });
      }
    };

    fetchQueryNf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!dataDanfes.length) return undefined;

    const refreshVisibleInvoiceContext = () => {
      void refreshInvoiceContext(dataDanfes, { includeTripDriver: true });
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
  }, [dataDanfes, refreshInvoiceContext]);

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

  function toggleLoadFilter(load: string) {
    setFilters((previous) => ({
      ...previous,
      loadNumbers: previous.loadNumbers.includes(load)
        ? previous.loadNumbers.filter((item) => item !== load)
        : [...previous.loadNumbers, load].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })),
    }));
  }

  function clearFilter(key: keyof typeof filters) {
    setFilters((previous) => ({
      ...previous,
      [key]: key === 'route' ? 'Todas' : key === 'loadNumbers' ? [] : '',
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

  const driverOptions = useMemo(
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

  const loadOptions = useMemo(
    () => Array.from(
      new Set(
        visibleDanfes
          .map((danfe) => String(danfe.load_number || '').trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })),
    [visibleDanfes],
  );

  const activeFilters = useMemo(() => {
    const entries: Array<{ key: keyof typeof filters; label: string }> = [];
    if (filters.nf.trim()) entries.push({ key: 'nf', label: `NF: ${filters.nf.trim()}` });
    if (filters.product.trim()) entries.push({ key: 'product', label: `Produto: ${filters.product.trim()}` });
    if (filters.customer.trim()) entries.push({ key: 'customer', label: `Cliente: ${filters.customer.trim()}` });
    if (filters.city.trim()) entries.push({ key: 'city', label: `Cidade: ${filters.city.trim()}` });
    if (filters.route !== 'Todas') entries.push({ key: 'route', label: `Rota: ${filters.route}` });
    if (filters.driver.trim()) entries.push({ key: 'driver', label: `Motorista: ${filters.driver.trim()}` });
    if (filters.status) entries.push({ key: 'status', label: `Status: ${filters.status}` });
    if (activeCompanyTab !== 'all') entries.push({ key: 'status', label: `Empresa: ${COMPANY_LABELS[activeCompanyTab] || activeCompanyTab}` });
    return entries;
  }, [activeCompanyTab, filters]);

  const danfes = useMemo(
    () => filterInvoiceListDanfes(visibleDanfes, deferredFilters, { invoiceContextByNf }),
    [visibleDanfes, deferredFilters, invoiceContextByNf],
  );

  async function openPDFInNewTab() {
    const currentFilteredDanfes = filterInvoiceListDanfes(visibleDanfes, filters, { invoiceContextByNf });
    const currentFilteredGroupedProducts = groupTodayInvoiceProducts(currentFilteredDanfes);
    if (currentFilteredGroupedProducts.length === 0) return;

    setIsPrinting(true);

    try {
      const blob = await pdf(<TodayProductList products={currentFilteredGroupedProducts} />).toBlob();
      const url = URL.createObjectURL(blob);

      setTimeout(() => {
        window.open(url);
        setIsPrinting(false);
      }, 3000);
    } catch (error) {
      console.error('Erro ao gerar lista de produtos:', error);
      setIsPrinting(false);
    }
  }

  function handleDanfeUpdated(updatedDanfe: IDanfe) {
    setDataDanfes((previous) => {
      const invoiceNumber = String(updatedDanfe.invoice_number);
      const nextRows = previous.filter((danfe) => String(danfe.invoice_number) !== invoiceNumber);
      return [sanitizeDanfeTextFields(updatedDanfe), ...nextRows];
    });
    void loadInvoiceContext([updatedDanfe], { force: true, includeTripDriver: true });
  }
  
  return (
    <div>
      <Header />
      <Container>
        <CompanyTabs activeTab={activeCompanyTab} onChange={setActiveCompanyTab} />
        <section
          data-tutorial="page-filters"
          aria-labelledby="invoice-search-title"
          className="mb-3 w-full max-w-[var(--content-max-width)] rounded-lg border border-border bg-card p-3 shadow-soft [&_input]:h-9 [&_button]:h-9"
        >
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h1 id="invoice-search-title" className="text-lg font-semibold text-text">Buscar notas</h1>
            <p className="text-sm text-muted">Consulte uma NF específica ou carregue as notas emitidas em um período.</p>
          </div>

          <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="self-end">
              <label htmlFor="invoice-number-search" className="mb-1.5 block text-sm font-medium text-text">
                Número da NF
              </label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <input
                  id="invoice-number-search"
                  value={searchNf}
                  type="text"
                  inputMode="numeric"
                  onChange={setFilter}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void getDanfeByNf();
                  }}
                  placeholder="Ex.: 123456"
                  disabled={isSearchingInvoice}
                  className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void getDanfeByNf()}
                  disabled={isSearchingInvoice || !searchNf.trim()}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-accent-strong bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  {isSearchingInvoice ? 'Buscando...' : 'Buscar NF'}
                </button>
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-text">Período de emissão</span>
              <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <label htmlFor="invoice-start-date" className="mb-1 block text-xs text-muted">Data inicial</label>
                  <DatePicker
                    id="invoice-start-date"
                    selected={startDate}
                    onChange={date => setStartDate(date)}
                    placeholderText="Data inicial"
                    dateFormat="dd/MM/yyyy"
                    locale="ptBR"
                    popperPlacement="bottom-start"
                    className="date-picker-input h-11"
                    wrapperClassName="w-full"
                    withPortal
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="invoice-end-date" className="mb-1 block text-xs text-muted">Data final</label>
                  <DatePicker
                    id="invoice-end-date"
                    selected={endDate}
                    onChange={date => setEndDate(date)}
                    placeholderText="Data final"
                    dateFormat="dd/MM/yyyy"
                    locale="ptBR"
                    popperPlacement="bottom-start"
                    className="date-picker-input h-11"
                    wrapperClassName="w-full"
                    withPortal
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void getDanfesByDate()}
                  disabled={!startDate || !endDate}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-accent-strong bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Buscar período
                </button>
              </div>
            </div>
          </div>

          {invoiceSearchFeedback ? (
            <div
              role="status"
              className={`mt-2 rounded-md border px-3 py-2 text-sm ${invoiceSearchFeedback.tone === 'danger'
                ? 'semantic-panel-danger'
                : invoiceSearchFeedback.tone === 'warning'
                  ? 'semantic-panel-warning'
                  : 'semantic-panel-info'}`}
            >
              <span>{invoiceSearchFeedback.message}</span>
              {invoiceSearchFeedback.actionUrl ? (
                <button
                  type="button"
                  onClick={() => navigate(invoiceSearchFeedback.actionUrl as string)}
                  className="ml-2 rounded-md border border-current/30 bg-card px-2 py-1 text-xs font-semibold"
                >
                  {invoiceSearchFeedback.actionLabel || 'Abrir referência'}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        <section
          aria-labelledby="invoice-filter-title"
          className="mb-3 w-full max-w-[var(--content-max-width)] rounded-lg border border-border bg-surface p-3 [&_input]:h-9 [&_select]:h-9"
        >
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 id="invoice-filter-title" className="text-base font-semibold text-text">Refinar resultados</h2>
              <p className="text-sm text-muted">Filtros aplicados às notas carregadas.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
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
                  disabled={isPrinting}
                  className="rounded-md border border-accent-strong bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPrinting ? 'Gerando lista...' : 'Abrir lista de produtos'}
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 min-[1100px]:grid-cols-[110px_minmax(135px,1.15fr)_minmax(120px,1fr)_minmax(120px,1fr)_130px_165px_165px]">
            <label className="block text-sm font-medium text-text">
              NF
              <input className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" type="text" value={filters.nf} onChange={(event) => updateFilter('nf', event.target.value)} placeholder="Número da nota" />
            </label>
            <label className="block text-sm font-medium text-text">
              Produto
              <input className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" type="text" value={filters.product} onChange={(event) => updateFilter('product', event.target.value)} placeholder="Código ou descrição" />
            </label>
            <label className="block text-sm font-medium text-text">
              Cliente
              <input className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" type="text" value={filters.customer} onChange={(event) => updateFilter('customer', event.target.value)} placeholder="Nome do cliente" />
            </label>
            <label className="block text-sm font-medium text-text">
              Cidade
              <input className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" type="text" value={filters.city} onChange={(event) => updateFilter('city', event.target.value)} placeholder="Nome da cidade" />
            </label>
            <label className="block text-sm font-medium text-text">
              Rota
              <select
                onChange={(event) => updateFilter('route', event.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                value={filters.route}
              >
                {routes.map((route, index) => (
                  <option value={route} key={`rota-${index}`}>{route}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-text">
              Motorista
              <select className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" value={filters.driver} onChange={(event) => updateFilter('driver', event.target.value)}>
                <option value="">Todos os motoristas</option>
                {driverOptions.map((driver) => (
                  <option key={driver} value={driver}>{driver}</option>
                ))}
              </select>
            </label>
            {loadOptions.length > 0 ? (
              <label className="block text-sm font-medium text-text">
                Cargas
                <select
                  className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  value=""
                  onChange={(event) => {
                    const selectedLoad = event.target.value;
                    if (selectedLoad) toggleLoadFilter(selectedLoad);
                  }}
                >
                  <option value="">Selecionar carga(s)</option>
                  {loadOptions.map((load) => {
                    const isActive = filters.loadNumbers.includes(load);
                    return <option key={load} value={load}>{isActive ? `✓ Carga ${load}` : `Carga ${load}`}</option>;
                  })}
                </select>
              </label>
            ) : null}
          </div>

        </section>
        <DanfeStatusLegend
          activeStatusFilter={filters.status}
          onChange={(value) => updateFilter('status', value)}
          totalCount={visibleDanfes.length}
          filteredCount={danfes.length}
        />
        <div className="mb-3 flex items-center gap-2 text-sm text-muted">
          <span className="rounded-full border border-border bg-surface px-3 py-1">
            {activeCompanyTab === 'all'
              ? 'Exibindo notas de todas as empresas.'
              : `Exibindo apenas ${COMPANY_LABELS[activeCompanyTab] || activeCompanyTab}.`}
          </span>
        </div>
        <div className="mb-s3 flex flex-wrap items-center gap-2 text-xs">
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
          <span className="text-muted">Lista de produtos baseada nos filtros atuais.</span>
        </div>
        <NotesFound>{`${danfes.length} Notas encontradas`}</NotesFound>
        <CardDanfes
          danfes={danfes}
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
        {isPrinting ? <div className="flex justify-center py-4"><span>Gerando lista de produtos...</span></div> : null}
        <ScrollToTopButton />
      </Container>
    </div>
  )
};

export default Invoices;
