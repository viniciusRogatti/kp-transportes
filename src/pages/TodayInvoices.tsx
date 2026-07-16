import React, { useCallback, useDeferredValue, useMemo, useState, useEffect } from "react";
import CardDanfes from "../components/CardDanfes";
import Header from "../components/Header";
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';
import { IDanfe, ITrip } from "../types/types";
import { ContainerDanfes, ContainerTodayInvoices, FilterBar, NotesFound } from "../style/TodayInvoices";
import ScrollToTopButton from "../components/ScrollToTopButton";
import TodayProductList from "../components/TodayProductList";
import DanfeStatusLegend from "../components/DanfeStatusLegend";
import CompanyTabs from "../components/CompanyTabs";
import { routes } from "../data/danfes";
import { API_URL } from "../data";
import { Container } from "../style/invoices";
import verifyToken from "../utils/verifyToken";
import { useNavigate } from "react-router";
import { pdf } from "@react-pdf/renderer";
import { LoaderPrinting } from "../style/Loaders";
import { format } from "date-fns";
import { createEmptyInvoiceListFilters, filterTodayInvoiceDanfes } from "../utils/danfeFilters";
import { sanitizeDanfeTextFields } from "../utils/textNormalization";
import { groupTodayInvoiceProducts } from "../utils/todayInvoiceProducts";
import useInvoiceSearchContext from "../hooks/useInvoiceSearchContext";
import { COMPANY_LABELS, COMPANY_TAB_ORDER, resolveDanfeCompanyCode } from "../utils/companyTabs";
import { handleAuthenticationError } from "../utils/authErrorHandler";
import { buildTodayInvoiceProductMatches, TodayInvoiceAssignment } from "../utils/todayInvoiceQuickSearch";
import { getOperationalStatusLabel, getSemanticToneClassName } from "../utils/statusStyles";

function TodayInvoices() {
  const [dataDanfes, setDataDanfes] = useState<IDanfe[]>([]);
  const [todayTrips, setTodayTrips] = useState<ITrip[]>([]);
  const [driverByInvoice, setDriverByInvoice] = useState<Record<string, string>>({});
  const [assignmentByInvoice, setAssignmentByInvoice] = useState<Record<string, TodayInvoiceAssignment>>({});
  const { invoiceContextByNf, loadInvoiceContext, refreshInvoiceContext } = useInvoiceSearchContext();
  const [filters, setFilters] = useState(createEmptyInvoiceListFilters);
  const [activeCompanyTab, setActiveCompanyTab] = useState<string>('all');
  const [allTabCompanyFilter, setAllTabCompanyFilter] = useState<string>('all');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const navigate = useNavigate();
  const deferredFilters = useDeferredValue(filters);

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
  }, []);

  async function loadTodayData() {
    try {
      const response = await axios.get(`${API_URL}/danfes`);
      const sanitizedRows = Array.isArray(response.data)
        ? response.data.map((danfe) => sanitizeDanfeTextFields(danfe))
        : [];
      setDataDanfes(sanitizedRows);
      await Promise.all([
        loadTodayTrips(),
        loadInvoiceContext(sanitizedRows, { includeTripDriver: true }),
      ]);
    } catch (error) {
      console.error('Erro ao buscar notas do dia atual:', error);
    }
  }

  async function loadTodayTrips() {
    try {
      const today = format(new Date(), 'dd-MM-yyyy');
      const { data } = await axios.get<ITrip[]>(`${API_URL}/trips/search/date/${today}`);
      const map: Record<string, string> = {};
      const assignmentMap: Record<string, TodayInvoiceAssignment> = {};
      if (Array.isArray(data)) {
        data.forEach((trip: any) => {
          const driverName = trip?.Driver?.name || '';
          const vehiclePlate = trip?.Car?.license_plate || '';
          (trip?.TripNotes || []).forEach((note: any) => {
            if (note?.invoice_number && driverName) {
              const invoiceNumber = String(note.invoice_number);
              map[invoiceNumber] = driverName;
              assignmentMap[invoiceNumber] = {
                driverName,
                vehiclePlate,
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
      setTodayTrips([]);
      setDriverByInvoice({});
      setAssignmentByInvoice({});
      return [];
    }
  }

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
  }, [dataDanfes, refreshInvoiceContext]);

  const driverOptions = useMemo(
    () => Array.from(new Set(Object.values(driverByInvoice))).sort((a, b) => a.localeCompare(b)),
    [driverByInvoice],
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
    () => filterTodayInvoiceDanfes(visibleDanfes, driverByInvoice, deferredFilters, invoiceContextByNf),
    [visibleDanfes, driverByInvoice, deferredFilters, invoiceContextByNf],
  );
  const quickProductMatches = useMemo(
    () => buildTodayInvoiceProductMatches(visibleDanfes, deferredFilters.product, assignmentByInvoice),
    [assignmentByInvoice, deferredFilters.product, visibleDanfes],
  );

  const clearFilter = useCallback((key: keyof typeof filters) => {
    setFilters((prev) => ({
      ...prev,
      [key]: key === 'route' ? 'Todas' : key === 'loadNumbers' ? [] : '',
    }));
  }, []);

  const activeFilters = useMemo(() => {
    const entries: Array<{ id: string; label: string; onClear: () => void }> = [];
    if (filters.nf.trim()) entries.push({ id: 'nf', label: `NF: ${filters.nf.trim()}`, onClear: () => clearFilter('nf') });
    if (filters.product.trim()) entries.push({ id: 'product', label: `Produto: ${filters.product.trim()}`, onClear: () => clearFilter('product') });
    if (filters.customer.trim()) entries.push({ id: 'customer', label: `Cliente: ${filters.customer.trim()}`, onClear: () => clearFilter('customer') });
    if (filters.city.trim()) entries.push({ id: 'city', label: `Cidade: ${filters.city.trim()}`, onClear: () => clearFilter('city') });
    if (filters.route !== 'Todas') entries.push({ id: 'route', label: `Rota: ${filters.route}`, onClear: () => clearFilter('route') });
    if (filters.driver.trim()) entries.push({ id: 'driver', label: `Motorista: ${filters.driver.trim()}`, onClear: () => clearFilter('driver') });
    if (filters.status) entries.push({ id: 'status', label: `Status: ${filters.status}`, onClear: () => clearFilter('status') });
    if (activeCompanyTab === 'all' && allTabCompanyFilter !== 'all') {
      entries.push({
        id: `company-${allTabCompanyFilter}`,
        label: `Empresa: ${COMPANY_LABELS[allTabCompanyFilter] || allTabCompanyFilter}`,
        onClear: () => setAllTabCompanyFilter('all'),
      });
    }
    return entries;
  }, [activeCompanyTab, allTabCompanyFilter, clearFilter, filters]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleLoadFilter(load: string) {
    setFilters((prev) => ({
      ...prev,
      loadNumbers: prev.loadNumbers.includes(load)
        ? prev.loadNumbers.filter((item) => item !== load)
        : [...prev.loadNumbers, load].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })),
    }));
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
    const currentFilteredDanfes = filterTodayInvoiceDanfes(visibleDanfes, driverByInvoice, filters, invoiceContextByNf);
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
        },
      });

      await axios.put(`${API_URL}/danfes/update-status`, {
        danfes: [{
          company_id: danfe.company_id,
          invoice_number: danfe.invoice_number,
          status: 'assigned',
        }],
      });

      const invoiceNumber = String(danfe.invoice_number);
      const updatedDanfe = sanitizeDanfeTextFields({
        ...danfe,
        status: 'assigned',
      });

      setDataDanfes((previous) => previous.map((row) => (
        String(row.invoice_number) === invoiceNumber && Number(row.company_id || 0) === Number(danfe.company_id || 0)
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
          vehiclePlate: targetTrip.Car?.license_plate || '',
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
                status: createdTripNote?.status || 'assigned',
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

  return (
    <ContainerTodayInvoices>
      <Header />
      <Container>
        <CompanyTabs activeTab={activeCompanyTab} onChange={setActiveCompanyTab} />
        <div className="sticky top-[calc(var(--header-height)+4px)] z-20 mb-3 rounded-lg border border-accent/35 bg-surface/95 p-2 shadow-elevated backdrop-blur md:hidden">
          <label htmlFor="mobile-product-search" className="mb-1 block text-xs font-semibold text-text">
            Busca rápida de produto
          </label>
          <div className="flex gap-2">
            <input
              id="mobile-product-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              value={filters.product}
              onChange={(event) => updateFilter('product', event.target.value)}
              placeholder="Código ou descrição"
              className="h-11 min-w-0 flex-1 rounded-md border border-accent/40 bg-surface-2 px-3 text-base text-text outline-none focus:ring-2 focus:ring-accent/60"
            />
            {filters.product ? (
              <button
                type="button"
                onClick={() => clearFilter('product')}
                className="h-11 rounded-md border border-border bg-card px-3 text-sm font-semibold text-text"
              >
                Limpar
              </button>
            ) : null}
          </div>
        </div>
        <FilterBar>
          {activeCompanyTab === 'all' ? (
            <select value={allTabCompanyFilter} onChange={(event) => setAllTabCompanyFilter(event.target.value)}>
              <option value="all">Empresa: todas</option>
              {companyOptions.map((companyCode) => (
                <option key={companyCode} value={companyCode}>
                  {COMPANY_LABELS[companyCode] || companyCode}
                </option>
              ))}
            </select>
          ) : null}
          <input type="text" value={filters.nf} onChange={(event) => updateFilter('nf', event.target.value)} placeholder="Filtrar por NF" />
          <input className="max-[768px]:hidden" type="text" value={filters.product} onChange={(event) => updateFilter('product', event.target.value)} placeholder="Filtrar produto (cód. ou descrição)" />
          <input type="text" value={filters.customer} onChange={(event) => updateFilter('customer', event.target.value)} placeholder="Filtrar por nome do cliente" />
          <input type="text" value={filters.city} onChange={(event) => updateFilter('city', event.target.value)} placeholder="Filtrar por cidade" />
          <select value={filters.driver} onChange={(event) => updateFilter('driver', event.target.value)}>
            <option value="">Motorista: todos</option>
            {driverOptions.map((driver) => (
              <option key={driver} value={driver}>{driver}</option>
            ))}
          </select>
          <div className="route-filter">
            Rotas:
            <select value={filters.route} onChange={(event) => updateFilter('route', event.target.value)}>
              {routes.map((route, index) => (
                <option value={route} key={`rota-${index}`}>
                  {route}
                </option>
              ))}
            </select>
          </div>
          <button onClick={resetFilters}>Limpar filtros</button>
          { filteredDanfes.length > 0 && <button onClick={openPDFInNewTab}>Abrir Lista de Produtos</button>}
          {loadOptions.length > 0 ? (
            <select
              value=""
              onChange={(event) => {
                const selectedLoad = event.target.value;
                if (selectedLoad) {
                  toggleLoadFilter(selectedLoad);
                }
              }}
            >
              <option value="">Selecionar carga(s)</option>
              {loadOptions.map((load) => {
                const isActive = filters.loadNumbers.includes(load);
                return (
                  <option key={load} value={load}>
                    {isActive ? `✓ Carga ${load}` : `Carga ${load}`}
                  </option>
                );
              })}
            </select>
          ) : null}
        </FilterBar>
        <DanfeStatusLegend
          activeStatusFilter={filters.status}
          onChange={(value) => updateFilter('status', value)}
          totalCount={visibleDanfes.length}
          filteredCount={filteredDanfes.length}
        />
        <div className="mb-s3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-border bg-surface/80 px-3 py-1 text-text">
            {activeFilters.length + filters.loadNumbers.length} filtro(s) ativo(s)
          </span>
          {activeFilters.map((filter) => (
            <button
              key={filter.id}
              className="rounded-full border border-border bg-surface/75 px-2.5 py-1 text-muted hover:text-text"
              onClick={filter.onClear}
            >
              {filter.label} ×
            </button>
          ))}
          {filters.loadNumbers.map((load) => (
            <button
              key={load}
              className="rounded-full border border-border bg-surface/75 px-2.5 py-1 text-muted hover:text-text"
              onClick={() => clearLoadFilter(load)}
            >
              {`Carga: ${load}`} ×
            </button>
          ))}
          <span className="text-muted">Lista de produtos baseada nos filtros atuais.</span>
        </div>
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
                        <span className="block text-text">Placa {row.vehiclePlate}</span>
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
                Nenhuma nota de hoje contém esse código ou descrição.
              </div>
            )}
          </section>
        ) : null}
        {dataDanfes.length === 0 ? (
          <p>Nenhuma nota lançada para hoje!</p>
        ) : filteredDanfes.length === 0 ? (
          <p>Nenhuma nota encontrada com os filtros atuais.</p>
        ) : (
          <ContainerDanfes> 
            { isPrinting ? (
              <LoaderPrinting />
            ) : (
              <>
                <NotesFound>{`${filteredDanfes.length} Notas encontradas`}</NotesFound>
                <span className="text-sm text-muted">
                  {activeCompanyTab === 'all'
                    ? allTabCompanyFilter === 'all'
                      ? 'Exibindo notas de todas as empresas.'
                      : `Exibindo apenas ${COMPANY_LABELS[allTabCompanyFilter] || allTabCompanyFilter}.`
                    : `Exibindo apenas ${COMPANY_LABELS[activeCompanyTab] || activeCompanyTab}.`}
                </span>
                <div className={filters.product.trim() ? 'hidden w-full md:block' : 'w-full'}>
                  <CardDanfes
                    danfes={filteredDanfes}
                    driverByInvoice={driverByInvoice}
                    invoiceContextByNf={invoiceContextByNf}
                    assignableTrips={assignableTrips}
                    onAssignDanfeToTrip={handleAssignDanfeToTrip}
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
