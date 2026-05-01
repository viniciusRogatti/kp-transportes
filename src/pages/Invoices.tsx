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
import IconButton from "../components/ui/IconButton";
import SearchInput from "../components/ui/SearchInput";
import ScrollToTopButton from "../components/ScrollToTopButton";
import { Container, DateAction, DateGroup, DateRow, SearchBar, SearchRow } from "../style/invoices";
import { FilterBar, NotesFound } from "../style/TodayInvoices";
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
registerLocale('ptBR', ptBR);

function Invoices() {
  const [dataDanfes, setDataDanfes] = useState<IDanfe[]>([]);
  const { invoiceContextByNf, loadInvoiceContext } = useInvoiceSearchContext();
  const [searchNf, setSearchNf] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [filters, setFilters] = useState(createEmptyInvoiceListFilters);
  const [isPrinting, setIsPrinting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
        await loadInvoiceContext(sanitizedRows, { includeTripDriver: true });
      } catch (error) {
        console.error('Não foi possível encontrar notas com essas datas', error);
      }
    }
  }

  function setFilter(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchNf(value)
  };

  async function getDanfeByNf () {
    const normalizedNf = searchNf.trim();
    if (!normalizedNf) return;

    try {
      const { data } = await axios.get(`${API_URL}/danfes/nf/${normalizedNf}`);

      if (data) {
        const sanitizedDanfe = sanitizeDanfeTextFields(data);
        await loadInvoiceContext([sanitizedDanfe], {
          force: true,
          includeTripDriver: true,
        });
        setDataDanfes((previous) => {
          const invoiceNumber = String(sanitizedDanfe.invoice_number);
          const nextRows = previous.filter((danfe) => String(danfe.invoice_number) !== invoiceNumber);
          return [sanitizedDanfe, ...nextRows];
        });
      }
    } catch (error) {
      console.error('Algo deu errado ao tentar buscar essa nf', error);
    }

    setSearchNf('');
  };

  useEffect(() => {
    const queryNf = searchParams.get('nf')?.trim();
    if (!queryNf) return;

    setSearchNf(queryNf);

    const fetchQueryNf = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/danfes/nf/${queryNf}`);
        if (!data) return;
        const sanitizedDanfe = sanitizeDanfeTextFields(data);
        setDataDanfes([sanitizedDanfe]);
        await loadInvoiceContext([sanitizedDanfe], { force: true, includeTripDriver: true });
      } catch (error) {
        console.error('Algo deu errado ao tentar buscar essa nf', error);
      }
    };

    fetchQueryNf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  const danfes = useMemo(
    () => filterInvoiceListDanfes(dataDanfes, deferredFilters, { invoiceContextByNf }),
    [dataDanfes, deferredFilters, invoiceContextByNf],
  );

  async function openPDFInNewTab() {
    const currentFilteredDanfes = filterInvoiceListDanfes(dataDanfes, filters, { invoiceContextByNf });
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
  }
  
  return (
    <div>
      <Header />
      <Container>
        <SearchBar>
          <SearchRow className="w-full grid-cols-1 max-[768px]:grid-cols-1">
            <SearchInput
              value={searchNf}
              type="number"
              onChange={setFilter}
              onSearch={getDanfeByNf}
              placeholder="Digite a nf"
              searchLabel="Pesquisar NF"
            />
          </SearchRow>
          <DateRow className="grid-cols-[1fr_auto] max-[768px]:grid-cols-[minmax(0,1fr)_auto]">
            <DateGroup>
              <DatePicker
                selected={startDate}
                onChange={date => setStartDate(date)}
                placeholderText="Data de início"
                dateFormat="yyyy-MM-dd"
                locale="ptBR"
                popperPlacement="bottom-start"
                className="date-picker-input"
                withPortal
              />
              <DatePicker
                selected={endDate}
                onChange={date => setEndDate(date)}
                placeholderText="Data de fim"
                dateFormat="yyyy-MM-dd"
                locale="ptBR"
                popperPlacement="bottom-start"
                className="date-picker-input"
                withPortal
              />
            </DateGroup>
            <DateAction className="justify-end max-[768px]:w-auto">
              <IconButton
                icon={Search}
                label="Buscar notas por periodo"
                onClick={getDanfesByDate}
                className="h-10 w-10 min-h-10 min-w-10 rounded-md"
                size="lg"
              />
            </DateAction>
          </DateRow>
          <div className="mt-2 flex w-full justify-end">
            <select
              onChange={(event) => updateFilter('route', event.target.value)}
              className="h-10 min-w-[170px] rounded-sm border border-accent/35 bg-surface-2/85 px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/60 max-[768px]:w-full max-[768px]:min-w-0"
              value={filters.route}
            >
              {routes.map((route, index) => (
                <option value={route} key={`rota-${index}`}>
                  {route}
                </option>
              ))}
            </select>
          </div>
        </SearchBar>

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
          <button onClick={resetFilters}>Limpar filtros</button>
          {danfes.length > 0 ? <button onClick={openPDFInNewTab}>Abrir Lista de Produtos</button> : null}
        </FilterBar>
        <DanfeStatusLegend
          activeStatusFilter={filters.status}
          onChange={(value) => updateFilter('status', value)}
          totalCount={dataDanfes.length}
          filteredCount={danfes.length}
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
        <NotesFound>{`${danfes.length} Notas encontradas`}</NotesFound>
        <CardDanfes
          danfes={danfes}
          invoiceContextByNf={invoiceContextByNf}
          onDanfeUpdated={handleDanfeUpdated}
          showLegend={false}
        />
        {isPrinting ? <div className="flex justify-center py-4"><span>Gerando lista de produtos...</span></div> : null}
        <ScrollToTopButton />
      </Container>
    </div>
  )
};

export default Invoices;
