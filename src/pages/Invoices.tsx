import { useEffect, useState } from "react";
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
import { cities, routes } from "../data/danfes";
import { useNavigate } from "react-router";
import verifyToken from "../utils/verifyToken";
import { useSearchParams } from "react-router-dom";
import { sanitizeDanfeTextFields } from "../utils/textNormalization";
import useInvoiceSearchContext from "../hooks/useInvoiceSearchContext";
registerLocale('ptBR', ptBR);

function Invoices() {
  const [danfes, setDanfes] = useState<IDanfe[]>([]);
  const [dataDanfes, setDataDanfes] = useState<IDanfe[]>([]);
  const { invoiceContextByNf, loadInvoiceContext } = useInvoiceSearchContext();
  const [nf, setNf] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
        setDanfes(sanitizedRows);
        setStartDate(null);
        setEndDate(null);
        setDataDanfes(sanitizedRows);
        await loadInvoiceContext(sanitizedRows);
      } catch (error) {
        console.error('Não foi possível encontrar notas com essas datas', error);
      }
    }
  }

  function setFilter(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setNf(value)
  };

  async function getDanfeByNf () {
    const normalizedNf = nf.trim();
    if (!normalizedNf) return;

    const isDuplicate = danfes.some((danfe) => danfe?.invoice_number === normalizedNf);
    if (!isDuplicate) {
      try {
        const { data } = await axios.get(`${API_URL}/danfes/nf/${normalizedNf}`);
        
        if (data) {
          const sanitizedDanfe = sanitizeDanfeTextFields(data);
          await loadInvoiceContext([sanitizedDanfe]);
          setDanfes([...danfes, sanitizedDanfe]);
        }
        
      } catch (error) {
        console.error('Algo deu errado ao tentar buscar essa nf', error);
      }
    }
    setNf('');
  };

  useEffect(() => {
    const queryNf = searchParams.get('nf')?.trim();
    if (!queryNf) return;

    setNf(queryNf);

    const fetchQueryNf = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/danfes/nf/${queryNf}`);
        if (!data) return;
        const sanitizedDanfe = sanitizeDanfeTextFields(data);
        setDanfes([sanitizedDanfe]);
        setDataDanfes([sanitizedDanfe]);
        await loadInvoiceContext([sanitizedDanfe]);
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

  function filterByNf(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;    
    const searchDanfe = dataDanfes.filter((danfe) => danfe.invoice_number.includes(value));
    setDanfes(searchDanfe);
  }

  function filterByProduct(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.toLowerCase();
    const searchDanfe = dataDanfes.filter((danfe) => danfe.DanfeProducts.some((product) => (
      product.Product.code.toLowerCase().includes(value)
      || product.Product.description.toLowerCase().includes(value)
    )) );
    setDanfes(searchDanfe);
  }

  function filterByCustomerName(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.toLocaleLowerCase();
    const searchDanfe = dataDanfes.filter((danfe) => danfe.Customer.name_or_legal_entity.toLocaleLowerCase().includes(value));
    setDanfes(searchDanfe);
  }

  function filterByCustomerCity(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.toLocaleLowerCase();
    const searchDanfe = dataDanfes.filter((danfe) => danfe.Customer.city.toLocaleLowerCase().includes(value));
    setDanfes(searchDanfe);
  }

  function filterByRoute(e: any) {
    const value = e.target.value
    if (value === 'Todas') return setDanfes(dataDanfes);
    else {
      const searchDanfe = dataDanfes.filter((danfe) => cities[danfe.Customer.city] === value)
      setDanfes(searchDanfe);
    }
  }

  const notesSignature = `${danfes.length}-${danfes[0]?.barcode ?? 'none'}-${danfes[danfes.length - 1]?.barcode ?? 'none'}`;
  
  return (
    <div>
      <Header />
      <Container>
        <SearchBar>
          <SearchRow className="w-full grid-cols-1 max-[768px]:grid-cols-1">
            <SearchInput
              value={nf}
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
              onChange={filterByRoute}
              className="h-10 min-w-[170px] rounded-sm border border-accent/35 bg-surface-2/85 px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/60 max-[768px]:w-full max-[768px]:min-w-0"
              defaultValue="Todas"
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
          <input type="text" onChange={filterByNf} placeholder="Filtrar por NF" />
          <input type="text" onChange={filterByProduct} placeholder="Filtrar produto (cód. ou descrição)" />
          <input type="text" onChange={filterByCustomerName} placeholder="Filtrar por nome do cliente" />
          <input type="text" onChange={filterByCustomerCity} placeholder="Filtrar por cidade" />
        </FilterBar>
        <NotesFound key={notesSignature}>{`${danfes.length} Notas encontradas`}</NotesFound>
        <CardDanfes danfes={danfes} animationKey={notesSignature} invoiceContextByNf={invoiceContextByNf} />
        <ScrollToTopButton />
      </Container>
    </div>
  )
};

export default Invoices;
