import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { IDanfe } from "../types/types";
import axios from "axios";
import { Search } from "lucide-react";
import CardDanfes from "../components/CardDanfes";
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
import { filterInvoiceListDanfes } from "../utils/danfeFilters";
import { sanitizeDanfeTextFields } from "../utils/textNormalization";
import useInvoiceSearchContext from "../hooks/useInvoiceSearchContext";
registerLocale('ptBR', ptBR);

function Invoices() {
  const [dataDanfes, setDataDanfes] = useState<IDanfe[]>([]);
  const { invoiceContextByNf, loadInvoiceContext } = useInvoiceSearchContext();
  const [searchNf, setSearchNf] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [filters, setFilters] = useState({
    nf: '',
    product: '',
    customer: '',
    city: '',
    route: 'Todas',
  });
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

  const danfes = useMemo(
    () => filterInvoiceListDanfes(dataDanfes, deferredFilters),
    [dataDanfes, deferredFilters],
  );
  
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
        </FilterBar>
        <NotesFound>{`${danfes.length} Notas encontradas`}</NotesFound>
        <CardDanfes danfes={danfes} invoiceContextByNf={invoiceContextByNf} />
        <ScrollToTopButton />
      </Container>
    </div>
  )
};

export default Invoices;
