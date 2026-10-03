import React, { useCallback, useDeferredValue, useMemo, useState, useEffect, useRef } from "react";
import CardDanfes from "../components/CardDanfes";
import Header from "../components/Header";
import axios from 'axios';
import { IDanfe, ITrip } from "../types/types";
import { ContainerDanfes, ContainerTodayInvoices } from "../style/TodayInvoices";
import ScrollToTopButton from "../components/ScrollToTopButton";
import TodayProductList from "../components/TodayProductList";
import DanfeStatusLegend from "../components/DanfeStatusLegend";
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
import { PackageSearch, Printer, RefreshCw, X } from "lucide-react";
import { WorkspaceButton, WorkspaceHeader, WorkspaceState } from "../components/ui/Workspace";
import { currentOperationDate, readTodayInvoiceView, saveTodayInvoiceView, todayInvoiceViewKey } from "../utils/todayInvoiceView";
import { brand } from "../config/brand";
import "../style/invoiceWorkspace.css";

import { createEmptyInvoiceListFilters, filterTodayInvoiceDanfes } from "../utils/danfeFilters";
import { sanitizeDanfeTextFields } from "../utils/textNormalization";
import { groupTodayInvoiceProducts } from "../utils/todayInvoiceProducts";
import useInvoiceSearchContext from "../hooks/useInvoiceSearchContext";
import { COMPANY_LABELS, COMPANY_TAB_ORDER, resolveDanfeCompanyCode } from "../utils/companyTabs";
import { handleAuthenticationError } from "../utils/authErrorHandler";
import { buildTodayInvoiceProductMatches, TodayInvoiceAssignment } from "../utils/todayInvoiceQuickSearch";
import { getDanfeLegendItem } from "../utils/statusStyles";

function TodayInvoices() {
  const [savedView] = useState(readTodayInvoiceView);
  const [viewKey] = useState(todayInvoiceViewKey);
  const [operationDate, setOperationDate] = useState(savedView.operationDate);
  const [moreFilters, setMoreFilters] = useState(savedView.moreFilters);
  const restoreScroll = useRef(true);
  const scrollPosition = useRef(savedView.scrollY);
  const operationDateRef = useRef(operationDate);
  operationDateRef.current = operationDate;
  const dataRequest = useRef(0);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tripsError, setTripsError] = useState('');
  const [printError, setPrintError] = useState('');
  const [feedback, setFeedback] = useState('');
  const printInFlight = useRef(false);
  const tripsRequest = useRef(0);
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
  const [filters, setFilters] = useState(savedView.filters);
  const [activeCompanyTab, setActiveCompanyTab] = useState<string>(savedView.company);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const navigate = useNavigate();
  const deferredFilters = useDeferredValue(filters);
  const routeCatalog = useRouteCatalog();
  const routeMap = useMemo(() => routeByCity(routeCatalog.data?.routes || []), [routeCatalog.data]);
  const cityOptions = useMemo(() => Array.from(new Map(dataDanfes
    .filter((danfe) => Boolean(danfe.Customer?.city))
    .map((danfe) => [normalizeRouteCity(danfe.Customer.city), danfe.Customer.city])).values())
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [dataDanfes]);

  const viewRef = useRef(savedView);
  viewRef.current = { operationDate, filters, company: activeCompanyTab, moreFilters, scrollY: scrollPosition.current, savedOn: currentOperationDate() };
  useEffect(() => {
    const rememberPosition = () => { if (!restoreScroll.current) scrollPosition.current = window.scrollY; };
    const save = () => saveTodayInvoiceView(viewKey, { ...viewRef.current, scrollY: scrollPosition.current });
    window.addEventListener('scroll', rememberPosition, { passive: true });
    window.addEventListener('pagehide', save);
    return () => { save(); window.removeEventListener('scroll', rememberPosition); window.removeEventListener('pagehide', save); };
  }, [viewKey]);
  useEffect(() => {
    if (loading || loadError || !restoreScroll.current) return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: scrollPosition.current, behavior: 'auto' });
      restoreScroll.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, loadError]);
  useEffect(() => {
    let active = true;
    const start = async () => {
      const token = localStorage.getItem('token');
      if (!token || !(await verifyToken(token))) { if (active) navigate('/'); return; }
      if (active) void loadTodayData();
    };
    void start();
    return () => { active = false; dataRequest.current += 1; tripsRequest.current += 1; };
  // API context changes with the operation date; filter changes are local.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operationDate]);

  async function loadTodayData() {
    const request = ++dataRequest.current;
    setLoading(true); setLoadError(''); setTripsError(''); setPrintError(''); setFeedback(''); setDataDanfes([]); setTodayTrips([]); setDriverByInvoice({}); setAssignmentByInvoice({});
    try {
      const response = await axios.get(`${API_URL}/danfes`, { params: { operationDate } });
      if (request !== dataRequest.current) return;
      if (!Array.isArray(response.data)) throw new Error('Resposta de notas inválida.');
      const sanitizedRows = response.data.map((danfe) => sanitizeDanfeTextFields(danfe));
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
    const request = ++tripsRequest.current;
    try {
      const today = operationDate;
      const { data } = await axios.get<ITrip[]>(`${API_URL}/trips/search/date/${today}`);
      if (operationDateRef.current !== today || request !== tripsRequest.current) return [];
      if (!Array.isArray(data)) throw new Error('Resposta de viagens inválida.');
      setTripsError('');
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
      if (operationDateRef.current !== operationDate || request !== tripsRequest.current) return [];
      setTripsError('As notas foram carregadas, mas as viagens estão indisponíveis. Atualize antes de atribuir uma nota.');
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
    const scopedCompanyCode = activeCompanyTab;
    if (!scopedCompanyCode || scopedCompanyCode === 'all') return dataDanfes;
    return dataDanfes.filter((danfe) => resolveDanfeCompanyCode(danfe) === scopedCompanyCode);
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
    if (filters.status) entries.push({ id: 'status', label: `Status: ${getDanfeLegendItem(filters.status)?.label || filters.status}`, onClear: () => clearFilter('status') });
    if (activeCompanyTab !== 'all') {
      entries.push({ id: 'company', label: `Empresa: ${COMPANY_LABELS[activeCompanyTab] || activeCompanyTab}`, onClear: () => setActiveCompanyTab('all') });
    }
    return entries;
  }, [activeCompanyTab, clearFilter, filters, routeCatalog.data]);

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
    setActiveCompanyTab('all');
  }

  async function openPDFInNewTab() {
    if (printInFlight.current || loading || loadError) return;
    const currentFilteredDanfes = filterTodayInvoiceDanfes(visibleDanfes, driverByInvoice, filters, invoiceContextByNf, routeMap);
    const products = groupTodayInvoiceProducts(currentFilteredDanfes);
    if (!products.length) return;
    const preview = window.open('', '_blank');
    if (!preview) {
      setPrintError('O navegador bloqueou a abertura da lista. Permita pop-ups para este site e tente novamente.');
      return;
    }
    preview.opener = null;
    printInFlight.current = true;
    setIsPrinting(true);
    setPrintError('');
    try {
      const blob = await pdf(<TodayProductList products={products} />).toBlob();
      const url = URL.createObjectURL(blob);
      if (!preview.closed) preview.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      preview.close();
      setPrintError('Não foi possível gerar o PDF. Seus filtros foram mantidos. Tente novamente.');
    } finally {
      printInFlight.current = false;
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
      setFeedback(`NF ${danfe.invoice_number} incluída na viagem #${targetTrip.id} de ${targetTrip.Driver?.name || 'motorista selecionado'}.`);
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

  const filterCount = activeFilters.length + filters.loadNumbers.length;
  const contextUnavailable = dataDanfes.some((danfe) => driverErrorByInvoice[buildInvoiceContextKey(danfe.company_id, danfe.invoice_number)]);
  const isFiltering = filters !== deferredFilters;

  return (
    <ContainerTodayInvoices>
      <Header />
      <Container className="operation-page invoice-workspace">
        <main className="invoice-workspace-content space-y-4">
          <WorkspaceHeader eyebrow={brand.productName} title="Notas do dia" description="Encontre a nota, confira os produtos e acompanhe a operação.">
            <WorkspaceButton onClick={() => void loadTodayData()} disabled={loading} aria-label="Atualizar notas">
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} /> Atualizar
            </WorkspaceButton>
            <WorkspaceButton primary disabled={loading || Boolean(loadError) || !filteredDanfes.length || isPrinting} onClick={openPDFInNewTab}>
              <Printer aria-hidden="true" className="h-4 w-4" /> {isPrinting ? 'Gerando PDF…' : 'Lista de produtos · PDF'}
            </WorkspaceButton>
          </WorkspaceHeader>
          <section data-tutorial="today-filters" aria-label="Busca e filtros de notas" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <InvoiceFilters filters={filters} setFilters={setFilters} cities={cityOptions} drivers={driverOptions} loads={loadOptions} routes={routeCatalog.data?.routes || []}
              progressive expanded={moreFilters} onExpandedChange={setMoreFilters} leadingFields={<>
              <label className="min-w-0 text-xs font-semibold text-muted">Data da operação
                <input type="date" value={operationDate} onChange={(event) => { if (event.target.value) { restoreScroll.current = false; setOperationDate(event.target.value); } }} className="workspace-field mt-1 block" />
              </label>
              <label className="min-w-0 text-xs font-semibold text-muted">Empresa atendida
                <select className="workspace-field mt-1 block" value={activeCompanyTab} onChange={(event) => setActiveCompanyTab(event.target.value)}>
                  <option value="all">Todas as empresas</option>
                  {Array.from(new Set([...companyOptions, ...(activeCompanyTab === 'all' ? [] : [activeCompanyTab])])).map((code) => <option key={code} value={code}>{COMPANY_LABELS[code] || code}</option>)}
                </select>
              </label>
            </>} />
            <div hidden={!moreFilters}><DanfeStatusLegend activeStatusFilter={filters.status} onChange={(value) => updateFilter('status', value)} totalCount={visibleDanfes.length} filteredCount={filteredDanfes.length} /></div>
            {filterCount > 0 && <div data-tutorial="today-active-filters" className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="text-xs font-semibold text-muted">{filterCount} filtro(s) ativo(s)</span>
              {activeFilters.map((filter) => <button key={filter.id} type="button" aria-label={`Remover filtro ${filter.label}`} className="workspace-button max-w-full !text-xs" onClick={filter.onClear}>
                <span className="min-w-0 break-words">{filter.label}</span><X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>)}
              {filters.loadNumbers.map((load) => <button key={load} type="button" aria-label={`Remover carga ${load}`} className="workspace-button !text-xs" onClick={() => clearLoadFilter(load)}>Carga: {load}<X className="h-3.5 w-3.5" aria-hidden="true" /></button>)}
              <WorkspaceButton onClick={resetFilters} className="!text-xs">Limpar todos os filtros</WorkspaceButton>
            </div>}
          </section>
          {feedback && <p role="status" className="rounded-xl border semantic-panel-success p-3 text-sm">{feedback}</p>}
          {printError && <p role="alert" className="rounded-xl border semantic-panel-danger p-3 text-sm">{printError}</p>}
          {(tripsError || contextUnavailable) && !loading && !loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border semantic-panel-warning p-3 text-sm">
            <p className="max-w-2xl">{tripsError || 'Não foi possível confirmar o motorista e o histórico de algumas notas. Os filtros por motorista podem estar incompletos.'}</p>
            <WorkspaceButton onClick={() => void loadTodayData()}>Tentar novamente</WorkspaceButton>
          </div>}
          {loading ? <WorkspaceState kind="loading" title="Carregando notas e viagens">Aguarde a consulta da operação selecionada.</WorkspaceState>
            : loadError ? <WorkspaceState kind="error" title="Não foi possível carregar a operação" action={<WorkspaceButton onClick={() => void loadTodayData()}>Tentar novamente</WorkspaceButton>}>{loadError}</WorkspaceState>
            : <>
              <details className="w-full rounded-xl border border-border bg-card [&_section]:mb-0 [&_section]:border-0">
                <summary className="min-h-[44px] cursor-pointer px-4 py-3 text-sm font-semibold text-text">Prévia de carga por rota <span className="ml-2 text-xs font-normal text-muted">Planejamento por cidade</span></summary>
                <p className="px-4 pb-2 text-xs text-muted">Estimativa com as notas filtradas. Não representa atribuição a motorista.</p>
                <RouteOverview danfes={filteredDanfes} availableCities={cityOptions} catalog={routeCatalog}
                  onSelectRoute={(id) => setFilters((previous) => ({ ...previous, route: previous.route.includes(id) ? previous.route.filter((value) => value !== id) : [...previous.route, id] }))} />
              </details>
              <div aria-live="polite" aria-atomic="true" className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-text">{filteredDanfes.length} notas <span className="text-sm font-normal text-muted">de {visibleDanfes.length} na seleção</span></h2>
                <span className="text-xs text-muted">{isFiltering ? 'Aplicando filtros…' : activeCompanyTab === 'all' ? 'Todas as empresas atendidas' : COMPANY_LABELS[activeCompanyTab] || activeCompanyTab}</span>
              </div>
              {filters.product.trim() && <div className="flex items-start gap-3 rounded-xl border semantic-panel-info p-3 text-sm">
                <PackageSearch className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div><strong>Conferência de produto: {filters.product.trim()}</strong>
                  <p className="mt-1">{quickProductMatches.length} itens correspondentes em {filteredDanfes.length} notas. Cada nota mostra somente os produtos encontrados, com suas unidades.</p>
                  <p className="mt-1 text-xs">O PDF mantém a lista completa de produtos das notas filtradas.</p>
                </div>
              </div>}
              {dataDanfes.length === 0 ? <WorkspaceState kind="empty" title="Nenhuma nota nesta operação">Confira a data selecionada ou atualize após a importação dos XMLs.</WorkspaceState>
                : filteredDanfes.length === 0 ? <WorkspaceState kind="empty" title="Nenhuma nota corresponde à busca" action={<WorkspaceButton onClick={resetFilters}>Limpar todos os filtros</WorkspaceButton>}>Experimente outro produto, cliente ou número de nota.</WorkspaceState>
                : <ContainerDanfes data-tutorial="today-results" aria-busy={isFiltering}>
                  <CardDanfes danfes={filteredDanfes} conferenceMode productSearch={deferredFilters.product}
                    driverByInvoice={driverByInvoice} driverLoadingByInvoice={driverLoadingByInvoice} invoiceContextByNf={invoiceContextByNf}
                    assignableTrips={tripsError ? [] : assignableTrips} onAssignDanfeToTrip={handleAssignDanfeToTrip} onDanfeUpdated={handleDanfeUpdated}
                    allowStatusActions={['admin', 'master', 'user', 'expedicao'].includes(localStorage.getItem('user_permission') || '')}
                    driverErrorByInvoice={driverErrorByInvoice} showLegend={false} />
                </ContainerDanfes>}
            </>}
          <ScrollToTopButton />
        </main>
      </Container>
    </ContainerTodayInvoices>
  );
}

export default TodayInvoices;
