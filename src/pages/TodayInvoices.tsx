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

function TodayInvoices() {
  const [dataDanfes, setDataDanfes] = useState<IDanfe[]>([]);
  const [driverByInvoice, setDriverByInvoice] = useState<Record<string, string>>({});
  const { invoiceContextByNf, loadInvoiceContext } = useInvoiceSearchContext();
  const [filters, setFilters] = useState(createEmptyInvoiceListFilters);
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

  const loadOptions = useMemo(
    () => Array.from(
      new Set(
        dataDanfes
          .map((danfe) => String(danfe.load_number || '').trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })),
    [dataDanfes],
  );

  const filteredDanfes = useMemo(
    () => filterTodayInvoiceDanfes(dataDanfes, driverByInvoice, deferredFilters, invoiceContextByNf),
    [dataDanfes, driverByInvoice, deferredFilters, invoiceContextByNf],
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
    return entries;
  }, [filters]);

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
  }

  async function openPDFInNewTab() {
    const currentFilteredDanfes = filterTodayInvoiceDanfes(dataDanfes, driverByInvoice, filters, invoiceContextByNf);
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
          description="Notas do dia em visão operacional multiempresa para a transportadora."
          totalLabel={`${filteredDanfes.length} NF(s)`}
        />
        <FilterBar>
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
          totalCount={dataDanfes.length}
          filteredCount={filteredDanfes.length}
        />
        <div className="mb-s3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-border bg-surface/80 px-3 py-1 text-text">
            {activeFilters.length + filters.loadNumbers.length} filtro(s) ativo(s)
          </span>
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              className="rounded-full border border-border bg-surface/75 px-2.5 py-1 text-muted hover:text-text"
              onClick={() => clearFilter(filter.key)}
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
