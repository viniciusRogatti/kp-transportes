import React, { useCallback, useDeferredValue, useMemo, useState, useEffect, useRef } from "react";
import CardDanfes from "../components/CardDanfes";
import Header from "../components/Header";
import axios from 'axios';
import { IDanfe, ITrip } from "../types/types";
import { ContainerDanfes, ContainerTodayInvoices } from "../style/TodayInvoices";
import ScrollToTopButton from "../components/ScrollToTopButton";
import TodayProductList from "../components/TodayProductList";
import DanfeStatusLegend from "../components/DanfeStatusLegend";
import CompanyTabs from "../components/CompanyTabs";
import InvoiceFilters from '../components/invoices/InvoiceFilters';
import RouteOverview from '../components/invoices/RouteOverview';
import useRouteCatalog from '../hooks/useRouteCatalog';
import { normalizeRouteCity, routeByCity } from '../utils/routeCatalog';
import { buildInvoiceContextKey } from '../utils/invoiceContextKey';
import { API_URL } from "../data";
import { Container } from "../style/invoices";
import verifyToken from "../utils/verifyToken";
import { useNavigate } from "react-router";
import { pdf } from "@react-pdf/renderer";
import { LoaderPrinting } from "../style/Loaders";

import { createEmptyInvoiceListFilters, filterTodayInvoiceDanfes } from "../utils/danfeFilters";
import { sanitizeDanfeTextFields } from "../utils/textNormalization";
import { groupTodayInvoiceProducts } from "../utils/todayInvoiceProducts";
import useInvoiceSearchContext from "../hooks/useInvoiceSearchContext";
import { COMPANY_LABELS, COMPANY_TAB_ORDER, resolveDanfeCompanyCode } from "../utils/companyTabs";
import { handleAuthenticationError } from "../utils/authErrorHandler";
import { buildTodayInvoiceProductMatches, TodayInvoiceAssignment } from "../utils/todayInvoiceQuickSearch";
import { getOperationalStatusLabel, getSemanticToneClassName } from "../utils/statusStyles";

function TodayInvoices() {
  const [operationDate, setOperationDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()));
  const operationDateRef = useRef(operationDate);
  operationDateRef.current = operationDate;
  const dataRequest = useRef(0);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataDanfes, setDataDanfes] = useState<IDanfe[]>([]);
  const [todayTrips, setTodayTrips] = useState<ITrip[]>([]);
  const [driverByInvoice, setDriverByInvoice] = useState<Record<string, string>>({});
  const [assignmentByInvoice, setAssignmentByInvoice] = useState<Record<string, TodayInvoiceAssignment>>({});
  const {
    invoiceContextByNf,
    driverLoadingByInvoice,
    driverErrorByInvoice,
    loadInvoiceContext,
    refreshInvoiceContext,
  } = useInvoiceSearchContext();
  const [filters, setFilters] = useState(createEmptyInvoiceListFilters);
  const [activeCompanyTab, setActiveCompanyTab] = useState<string>('all');
  const [allTabCompanyFilter, setAllTabCompanyFilter] = useState<string>('all');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const navigate = useNavigate();
  const deferredFilters = useDeferredValue(filters);
  const routeCatalog = useRouteCatalog();
  const routeMap = useMemo(() => routeByCity(routeCatalog.data?.routes || []), [routeCatalog.data]);
  const cityOptions = useMemo(() => Array.from(new Map(dataDanfes
    .filter((danfe) => Boolean(danfe.Customer?.city))
    .map((danfe) => [normalizeRouteCity(danfe.Customer.city), danfe.Customer.city])).values())
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [dataDanfes]);

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
    loadTodayData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operationDate]);

  async function loadTodayData() {
    const request = ++dataRequest.current;
    setLoading(true); setLoadError(''); setDataDanfes([]); setTodayTrips([]); setDriverByInvoice({}); setAssignmentByInvoice({});
    try {
      const response = await axios.get(`${API_URL}/danfes`, { params: { operationDate } });
      if (request !== dataRequest.current) return;
      const sanitizedRows = Array.isArray(response.data)
        ? response.data.map((danfe) => sanitizeDanfeTextFields(danfe))
        : [];
      setDataDanfes(sanitizedRows);
      await Promise.all([
        loadTodayTrips(),
        loadInvoiceContext(sanitizedRows, { includeTripDriver: true }),
      ]);
    } catch (error) {
      if (request === dataRequest.current) setLoadError('Não foi possível carregar as notas da operação. Tente novamente.');
    } finally { if (request === dataRequest.current) setLoading(false); }
  }

  const loadTodayTrips = useCallback(async () => {
    try {
      const today = operationDate;
      const { data } = await axios.get<ITrip[]>(`${API_URL}/trips/search/date/${today}`);
      if (operationDateRef.current !== today) return [];
      const map: Record<string, string> = {};
      const assignmentMap: Record<string, TodayInvoiceAssignment> = {};
      if (Array.isArray(data)) {
        data.forEach((trip: any) => {
          const driverName = trip?.Driver?.name || '';
          (trip?.TripNotes || []).forEach((note: any) => {
            if (note?.invoice_number && driverName) {
              const invoiceNumber = buildInvoiceContextKey(note.company_id, note.invoice_number);
              map[invoiceNumber] = driverName;
              assignmentMap[invoiceNumber] = {
                driverName,
                tripId: Number(trip?.id) || null,
              };
            }
          });
        });
      }
      setTodayTrips(Array.isArray(data) ? data : []);
      setDriverByInvoice(map);
      setAssignmentByInvoice(assignmentMap);
      return Array.isArray(data) ? data : [];
    } catch {
      if (operationDateRef.current !== operationDate) return [];
      setLoadError('Notas carregadas, mas não foi possível consultar as viagens. Atualize antes de atribuir.');
      setTodayTrips([]);
      setDriverByInvoice({});
      setAssignmentByInvoice({});
      return [];
    }
  }, [operationDate]);

  useEffect(() => {
    if (!dataDanfes.length) return undefined;

    const refreshVisibleInvoiceContext = () => {
      void Promise.all([
        loadTodayTrips(),
        refreshInvoiceContext(dataDanfes, { includeTripDriver: true }),
      ]);
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
  }, [dataDanfes, refreshInvoiceContext, loadTodayTrips]);

  const driverOptions = useMemo(
    () => Array.from(new Set([...Object.values(driverByInvoice), ...Object.values(invoiceContextByNf).map((context) => context.driver_name || '')].filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [driverByInvoice, invoiceContextByNf],
  );

  const companyOptions = useMemo(() => {
    const dynamicOptions = Array.from(
          new Set(
            dataDanfes
          .map((danfe) => resolveDanfeCompanyCode(danfe))
          .filter(Boolean),
      ),
    );

    return dynamicOptions.sort((a, b) => {
      const orderDiff = COMPANY_TAB_ORDER.indexOf(a as typeof COMPANY_TAB_ORDER[number])
        - COMPANY_TAB_ORDER.indexOf(b as typeof COMPANY_TAB_ORDER[number]);
      if (orderDiff !== 0) return orderDiff;
      return (COMPANY_LABELS[a] || a).localeCompare(COMPANY_LABELS[b] || b, 'pt-BR', { sensitivity: 'base' });
    });
  }, [dataDanfes]);

  const visibleDanfes = useMemo(() => {
    const scopedCompanyCode = activeCompanyTab === 'all' ? allTabCompanyFilter : activeCompanyTab;
    if (!scopedCompanyCode || scopedCompanyCode === 'all') return dataDanfes;
    return dataDanfes.filter((danfe) => resolveDanfeCompanyCode(danfe) === scopedCompanyCode);
  }, [activeCompanyTab, allTabCompanyFilter, dataDanfes]);

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

  const filteredDanfes = useMemo(
    () => filterTodayInvoiceDanfes(visibleDanfes, driverByInvoice, deferredFilters, invoiceContextByNf, routeMap),
    [visibleDanfes, driverByInvoice, deferredFilters, invoiceContextByNf, routeMap],
  );
  const quickProductMatches = useMemo(
    () => buildTodayInvoiceProductMatches(filteredDanfes, deferredFilters.product, assignmentByInvoice),
    [assignmentByInvoice, deferredFilters.product, filteredDanfes],
  );

  const clearFilter = useCallback((key: keyof typeof filters) => {
    setFilters((prev) => ({
      ...prev,
      [key]: ['route', 'city', 'driver', 'loadNumbers'].includes(key) ? [] : '',
    }));
  }, []);

  const activeFilters = useMemo(() => {
    const entries: Array<{ id: string; label: string; onClear: () => void }> = [];
    if (filters.nf.trim()) entries.push({ id: 'nf', label: `NF: ${filters.nf.trim()}`, onClear: () => clearFilter('nf') });
    if (filters.product.trim()) entries.push({ id: 'product', label: `Produto: ${filters.product.trim()}`, onClear: () => clearFilter('product') });
    if (filters.customer.trim()) entries.push({ id: 'customer', label: `Cliente: ${filters.customer.trim()}`, onClear: () => clearFilter('customer') });
    if (filters.city.join(', ')) entries.push({ id: 'city', label: `Cidade: ${filters.city.join(', ')}`, onClear: () => clearFilter('city') });
    if (filters.route.length > 0) entries.push({ id: 'route', label: `Rota: ${filters.route.map((id) => routeCatalog.data?.routes.find((route) => route.id === id)?.name || 'Sem rota definida').join(', ')}`, onClear: () => clearFilter('route') });
    if (filters.driver.join(', ')) entries.push({ id: 'driver', label: `Motorista: ${filters.driver.join(', ')}`, onClear: () => clearFilter('driver') });
    if (filters.status) entries.push({ id: 'status', label: `Status: ${filters.status}`, onClear: () => clearFilter('status') });
    if (activeCompanyTab === 'all' && allTabCompanyFilter !== 'all') {
      entries.push({
        id: `company-${allTabCompanyFilter}`,
        label: `Empresa: ${COMPANY_LABELS[allTabCompanyFilter] || allTabCompanyFilter}`,
        onClear: () => setAllTabCompanyFilter('all'),
      });
    }
    return entries;
  }, [activeCompanyTab, allTabCompanyFilter, clearFilter, filters, routeCatalog.data]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }


  function clearLoadFilter(load: string) {
    setFilters((prev) => ({
      ...prev,
      loadNumbers: prev.loadNumbers.filter((item) => item !== load),
    }));
  }

  function resetFilters() {
    setFilters(createEmptyInvoiceListFilters());
    setAllTabCompanyFilter('all');
  }

  async function openPDFInNewTab() {
    const currentFilteredDanfes = filterTodayInvoiceDanfes(visibleDanfes, driverByInvoice, filters, invoiceContextByNf, routeMap);
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

  const assignableTrips = useMemo(
    () => todayTrips
      .filter((trip) => Boolean(String(trip.Driver?.name || '').trim()))
      .slice()
      .sort((left, right) => {
        const runDiff = Number(left.run_number || 1) - Number(right.run_number || 1);
        if (runDiff !== 0) return runDiff;
        return String(left.Driver?.name || '').localeCompare(String(right.Driver?.name || ''), 'pt-BR', { sensitivity: 'base' });
      }),
    [todayTrips],
  );

  async function handleAssignDanfeToTrip(danfe: IDanfe, tripId: number) {
    const targetTrip = todayTrips.find((trip) => Number(trip.id) === Number(tripId));
    if (!targetTrip) {
      throw new Error('Rota selecionada não encontrada.');
    }

    try {
      const { data: createdTripNote } = await axios.put(`${API_URL}/trips/add-note/${tripId}`, {
        noteData: {
          company_id: danfe.company_id,
          invoice_number: danfe.invoice_number,
          customer_name: danfe.Customer?.name_or_legal_entity || '-',
          customer_id: danfe.customer_id || null,
          city: danfe.Customer?.city || 'Cidade não informada',
          gross_weight: String(danfe.gross_weight || 0),
          status: 'assigned',
          box_quantity: danfe.box_quantity,
        },
      });

      const invoiceNumber = buildInvoiceContextKey(danfe.company_id, danfe.invoice_number);
      const assignedStatus = String(createdTripNote?.status || 'assigned');
      const updatedDanfe = sanitizeDanfeTextFields({
        ...danfe,
        status: targetTrip.is_conference_only ? danfe.status : assignedStatus,
      });

      setDataDanfes((previous) => previous.map((row) => (
        buildInvoiceContextKey(row.company_id, row.invoice_number) === invoiceNumber
          ? updatedDanfe
          : row
      )));
      setDriverByInvoice((previous) => ({
        ...previous,
        [invoiceNumber]: targetTrip.Driver?.name || previous[invoiceNumber] || '',
      }));
      setAssignmentByInvoice((previous) => ({
        ...previous,
        [invoiceNumber]: {
          driverName: targetTrip.Driver?.name || '',
          tripId: Number(targetTrip.id) || null,
        },
      }));
      setTodayTrips((previous) => previous.map((trip) => (
        Number(trip.id) === Number(tripId)
          ? {
            ...trip,
            TripNotes: [
              ...(trip.TripNotes || []),
              {
                ...createdTripNote,
                status: assignedStatus,
              },
            ],
          }
          : trip
      )));

      void refreshInvoiceContext([updatedDanfe], { includeTripDriver: true });
      window.alert(`NF ${danfe.invoice_number} atribuída à rota de ${targetTrip.Driver?.name || 'motorista selecionado'}.`);
    } catch (error) {
      if (handleAuthenticationError(error)) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      throw error;
    }
  }

  function handleDanfeUpdated(updated: IDanfe) {
    setDataDanfes((old) => old.map((row) => buildInvoiceContextKey(row.company_id, row.invoice_number) === buildInvoiceContextKey(updated.company_id, updated.invoice_number)
      ? sanitizeDanfeTextFields(updated) : row));
    void refreshInvoiceContext([updated], { includeTripDriver: true });
  }

  return (
    <ContainerTodayInvoices>
      <Header />
      <Container>
        <CompanyTabs activeTab={activeCompanyTab} onChange={setActiveCompanyTab} />
        <section data-tutorial="today-filters" className="mb-3 w-full rounded-lg border border-border bg-surface p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div><h1 className="font-semibold text-text">Notas do dia</h1></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded border border-border bg-card px-3 py-2 text-sm text-text" onClick={resetFilters}>Limpar filtros</button>
              <button type="button" disabled={!filteredDanfes.length || isPrinting} className="rounded bg-accent px-3 py-2 text-sm text-white disabled:opacity-50" onClick={openPDFInNewTab}>{isPrinting ? 'Gerando lista…' : 'Abrir lista de produtos'}</button>
            </div>
          </div>
          <InvoiceFilters filters={filters} setFilters={setFilters} cities={cityOptions} drivers={driverOptions} loads={loadOptions} routes={routeCatalog.data?.routes || []}
            leadingFields={<>
              <label className="min-w-0 text-xs font-medium text-text">Data da operação
                <input type="date" value={operationDate} onChange={(event) => { if (event.target.value) setOperationDate(event.target.value); }} className="mt-1 block h-9 w-full min-w-0 rounded-md border border-border bg-card px-2 text-text" />
              </label>
              {activeCompanyTab === 'all' ? <label className="min-w-0 text-xs font-medium text-text">Empresa
                <select className="mt-1 block h-9 w-full rounded-md border border-border bg-card px-2 text-text" value={allTabCompanyFilter} onChange={(event) => setAllTabCompanyFilter(event.target.value)}>
                  <option value="all">Todas</option>{companyOptions.map((code) => <option key={code} value={code}>{COMPANY_LABELS[code] || code}</option>)}
                </select></label> : null}
            </>} />
        </section>
        {loadError ? <p role="alert" className="mb-3 w-full rounded border p-3 text-sm semantic-panel-danger">{loadError} <button type="button" onClick={() => void loadTodayData()} className="underline">Atualizar operação</button></p> : null}
        {loading ? <p role="status" className="mb-3 text-sm text-muted">Carregando operação…</p> : null}
        <details className="mb-2 w-full rounded-lg border border-border bg-surface [&_section]:mb-0 [&_section]:border-0">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text">Prévia de carga por rota <span className="ml-2 text-xs font-normal text-muted">Expandir para consultar</span></summary>
        <RouteOverview danfes={filteredDanfes} availableCities={cityOptions} catalog={routeCatalog}
          onSelectRoute={(id) => setFilters((old) => ({ ...old, route: old.route.includes(id) ? old.route.filter((value) => value !== id) : [...old.route, id] }))} />
        </details>
        <DanfeStatusLegend
          activeStatusFilter={filters.status}
          onChange={(value) => updateFilter('status', value)}
          totalCount={visibleDanfes.length}
          filteredCount={filteredDanfes.length}
        />
        {activeFilters.length + filters.loadNumbers.length > 0 ? <div data-tutorial="today-active-filters" className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">
            {activeFilters.length + filters.loadNumbers.length} filtro(s) ativo(s)
          </span>
          {activeFilters.map((filter) => (
            <button
              key={filter.id}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-muted hover:text-text"
              onClick={filter.onClear}
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
        {filters.product.trim() ? (
          <section className="mb-4 md:hidden" aria-live="polite">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-text">Produtos encontrados</h2>
              <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs text-muted">
                {quickProductMatches.length} resultado(s)
              </span>
            </div>
            {quickProductMatches.length ? (
              <div className="space-y-2">
                {quickProductMatches.map((row) => (
                  <article key={row.key} className="rounded-lg border border-border bg-card p-3 shadow-soft">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-lg text-text">{row.productCode}</strong>
                          <button
                            type="button"
                            onClick={() => void navigator.clipboard?.writeText(row.productCode)}
                            className="rounded border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-muted"
                          >
                            Copiar código
                          </button>
                        </div>
                        <p className="mt-1 text-sm text-text">{row.productDescription}</p>
                      </div>
                      <span className="shrink-0 rounded-md border semantic-solid-info px-2 py-1 text-base font-bold">
                        {`${row.quantity} ${row.unit}`.trim()}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-border bg-surface-2 p-2">
                        <span className="block text-muted">NF / Cliente</span>
                        <strong className="block text-text">NF {row.invoiceNumber}</strong>
                        <span className="line-clamp-2 text-text">{row.customerName}</span>
                        <span className="block text-muted">{row.city}</span>
                      </div>
                      <div className="rounded-md border border-border bg-surface-2 p-2">
                        <span className="block text-muted">Carga</span>
                        <strong className="block text-text">{row.driverName}</strong>
                        <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getSemanticToneClassName(row.driverName === 'Sem motorista' ? 'warning' : 'success')}`}>
                          {getOperationalStatusLabel(row.status)}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border semantic-panel-warning p-4 text-center text-sm">
                Nenhum produto encontrado com os filtros atuais.
              </div>
            )}
          </section>
        ) : null}
        {dataDanfes.length === 0 ? (
          <p>Nenhuma nota encontrada para a data operacional selecionada.</p>
        ) : filteredDanfes.length === 0 ? (
          <p>Nenhuma nota encontrada com os filtros atuais.</p>
        ) : (
          <ContainerDanfes data-tutorial="today-results">
            { isPrinting ? (
              <LoaderPrinting />
            ) : (
              <>
                <div className="flex w-full flex-wrap items-center justify-between gap-1 text-sm">
                <h2 className="font-semibold text-text">{`${filteredDanfes.length} Notas encontradas`}</h2>
                <span className="text-sm text-muted">
                  {activeCompanyTab === 'all'
                    ? allTabCompanyFilter === 'all'
                      ? 'Exibindo notas de todas as empresas.'
                      : `Exibindo apenas ${COMPANY_LABELS[allTabCompanyFilter] || allTabCompanyFilter}.`
                    : `Exibindo apenas ${COMPANY_LABELS[activeCompanyTab] || activeCompanyTab}.`}
                </span>
                </div>
                <div className="w-full">
                  <CardDanfes
                    danfes={filteredDanfes}
                    driverByInvoice={driverByInvoice}
                    driverLoadingByInvoice={driverLoadingByInvoice}
                    invoiceContextByNf={invoiceContextByNf}
                    assignableTrips={assignableTrips}
                    onAssignDanfeToTrip={handleAssignDanfeToTrip}
                    onDanfeUpdated={handleDanfeUpdated}
                    allowStatusActions={['admin', 'master', 'user', 'expedicao'].includes(localStorage.getItem('user_permission') || '')}
                    driverErrorByInvoice={driverErrorByInvoice}
                    showLegend={false}
                  />
                </div>
              </>
            )}
          </ContainerDanfes>
        )}
        <ScrollToTopButton />
      </Container>
    </ContainerTodayInvoices>
  );
}

export default TodayInvoices;
