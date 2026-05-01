import React, { useDeferredValue, useMemo, useState, useEffect } from "react";
import CardDanfes from "../components/CardDanfes";
import CompanyScopeBanner from "../components/CompanyScopeBanner";
import Header from "../components/Header";
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';
import { IDanfe } from "../types/types";
import { ContainerDanfes, ContainerTodayInvoices, FilterBar, NotesFound } from "../style/TodayInvoices";
import ScrollToTopButton from "../components/ScrollToTopButton";
import TodayProductList from "../components/TodayProductList";
import DanfeStatusLegend from "../components/DanfeStatusLegend";
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

const COMPANY_TAB_ORDER = ['mar_e_rio', 'brazilian_fish', 'pronto'] as const;

const COMPANY_LABELS: Record<string, string> = {
  all: 'Todas',
  mar_e_rio: 'MAR E RIO',
  brazilian_fish: 'BRASFISH',
  pronto: 'PRONTO',
};

const resolveCompanyCode = (danfe: IDanfe) => String(danfe.company?.code || '').trim().toLowerCase();

function TodayInvoices() {
  const [dataDanfes, setDataDanfes] = useState<IDanfe[]>([]);
  const [driverByInvoice, setDriverByInvoice] = useState<Record<string, string>>({});
  const { invoiceContextByNf, loadInvoiceContext } = useInvoiceSearchContext();
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
        loadTodayDrivers(),
        loadInvoiceContext(sanitizedRows),
      ]);
    } catch (error) {
      console.error('Erro ao buscar notas do dia atual:', error);
    }
  }

  async function loadTodayDrivers() {
    try {
      const today = format(new Date(), 'dd-MM-yyyy');
      const { data } = await axios.get(`${API_URL}/trips/search/date/${today}`);
      const map: Record<string, string> = {};
      if (Array.isArray(data)) {
        data.forEach((trip: any) => {
          const driverName = trip?.Driver?.name || '';
          (trip?.TripNotes || []).forEach((note: any) => {
            if (note?.invoice_number && driverName) {
              map[String(note.invoice_number)] = driverName;
            }
          });
        });
      }
      setDriverByInvoice(map);
    } catch {
      setDriverByInvoice({});
    }
  }

  const driverOptions = useMemo(
    () => Array.from(new Set(Object.values(driverByInvoice))).sort((a, b) => a.localeCompare(b)),
    [driverByInvoice],
  );

  const companyOptions = useMemo(() => {
    const dynamicOptions = Array.from(
      new Set(
        dataDanfes
          .map((danfe) => resolveCompanyCode(danfe))
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
    return dataDanfes.filter((danfe) => resolveCompanyCode(danfe) === scopedCompanyCode);
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
  }, [activeCompanyTab, allTabCompanyFilter, filters]);

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

  function clearFilter(key: keyof typeof filters) {
    setFilters((prev) => ({
      ...prev,
      [key]: key === 'route' ? 'Todas' : key === 'loadNumbers' ? [] : '',
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

  return (
    <ContainerTodayInvoices>
      <Header />
      <Container>
        <CompanyScopeBanner
          title="Notas do Dia"
          description="Notas do dia separadas por empresa para a operação da transportadora, com visão consolidada na aba Todas."
          totalLabel={`${filteredDanfes.length} NF(s)`}
        />
        <div className="mb-s4 flex flex-wrap gap-2">
          <button
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              activeCompanyTab === 'mar_e_rio'
                ? 'border-accent bg-accent text-[#04131e]'
                : 'border-border bg-surface/80 text-text hover:border-accent/60'
            }`}
            onClick={() => setActiveCompanyTab('mar_e_rio')}
          >
            MAR E RIO
          </button>
          <button
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              activeCompanyTab === 'brazilian_fish'
                ? 'border-accent bg-accent text-[#04131e]'
                : 'border-border bg-surface/80 text-text hover:border-accent/60'
            }`}
            onClick={() => setActiveCompanyTab('brazilian_fish')}
          >
            BRASFISH
          </button>
          <button
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              activeCompanyTab === 'pronto'
                ? 'border-accent bg-accent text-[#04131e]'
                : 'border-border bg-surface/80 text-text hover:border-accent/60'
            }`}
            onClick={() => setActiveCompanyTab('pronto')}
          >
            PRONTO
          </button>
          <button
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              activeCompanyTab === 'all'
                ? 'border-accent bg-accent text-[#04131e]'
                : 'border-border bg-surface/80 text-text hover:border-accent/60'
            }`}
            onClick={() => setActiveCompanyTab('all')}
          >
            Todas
          </button>
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
          <input type="text" value={filters.product} onChange={(event) => updateFilter('product', event.target.value)} placeholder="Filtrar produto (cód. ou descrição)" />
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
                <CardDanfes
                  danfes={filteredDanfes}
                  driverByInvoice={driverByInvoice}
                  invoiceContextByNf={invoiceContextByNf}
                  showLegend={false}
                />
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
