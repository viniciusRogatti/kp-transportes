import { useEffect, useState } from "react";
import { IDanfe, IOccurrence, IReturnBatch, IInvoiceSearchContext } from "../types/types";
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
registerLocale('ptBR', ptBR);

function Invoices() {
  const [danfes, setDanfes] = useState<IDanfe[]>([]);
  const [dataDanfes, setDataDanfes] = useState<IDanfe[]>([]);
  const [invoiceContextByNf, setInvoiceContextByNf] = useState<Record<string, IInvoiceSearchContext>>({});
  const [nf, setNf] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const normalizeInvoiceNumber = (value: unknown) => String(value || '').trim();

  const buildInvoiceContext = (invoiceNumber: string, occurrences: IOccurrence[], returnBatches: IReturnBatch[]): IInvoiceSearchContext => {
    const creditLetterOccurrences = occurrences.filter((occurrence) => (
      String(occurrence.resolution_type || '').trim().toLowerCase() === 'talao_mercadoria_faltante'
    ));
    const creditLetterCompletedCount = creditLetterOccurrences.filter((occurrence) => (
      String(occurrence.credit_status || '').trim().toLowerCase() === 'completed'
    )).length;
    const creditLetterPendingCount = Math.max(0, creditLetterOccurrences.length - creditLetterCompletedCount);

    const returnTypes = Array.from(new Set(
      returnBatches.flatMap((batch) => (
        (batch.notes || [])
          .filter((note) => normalizeInvoiceNumber(note.invoice_number) === invoiceNumber)
          .map((note) => note.return_type)
      ))
    ))
      .filter((returnType): returnType is 'total' | 'partial' | 'sobra' | 'coleta' => (
        ['total', 'partial', 'sobra', 'coleta'].includes(String(returnType))
      ));

    return {
      occurrence_count: occurrences.length,
      occurrence_pending_count: occurrences.filter((occurrence) => occurrence.status === 'pending').length,
      occurrence_resolved_count: occurrences.filter((occurrence) => occurrence.status === 'resolved').length,
      credit_letter_count: creditLetterOccurrences.length,
      credit_letter_pending_count: creditLetterPendingCount,
      credit_letter_completed_count: creditLetterCompletedCount,
      return_count: returnTypes.length,
      return_types: returnTypes,
    };
  };

  async function loadInvoiceContext(danfesToProcess: IDanfe[]) {
    const uniqueInvoiceNumbers = Array.from(new Set(
      danfesToProcess
        .map((danfe) => normalizeInvoiceNumber(danfe.invoice_number))
        .filter(Boolean),
    ));
    const missingInvoiceNumbers = uniqueInvoiceNumbers.filter((invoiceNumber) => !invoiceContextByNf[invoiceNumber]);
    if (!missingInvoiceNumbers.length) return;

    const contextEntries = await Promise.all(
      missingInvoiceNumbers.map(async (invoiceNumber) => {
        try {
          const [occurrencesResponse, returnBatchesResponse] = await Promise.all([
            axios.get<IOccurrence[]>(`${API_URL}/occurrences/search`, {
              params: { invoice_number: invoiceNumber },
            }),
            axios.get<IReturnBatch[]>(`${API_URL}/returns/batches/search`, {
              params: {
                invoice_number: invoiceNumber,
                workflow_status: 'all',
              },
            }),
          ]);

          const occurrences = Array.isArray(occurrencesResponse.data) ? occurrencesResponse.data : [];
          const returnBatches = Array.isArray(returnBatchesResponse.data) ? returnBatchesResponse.data : [];

          return [invoiceNumber, buildInvoiceContext(invoiceNumber, occurrences, returnBatches)] as const;
        } catch (error) {
          console.error(`Erro ao carregar contexto da NF ${invoiceNumber}`, error);
          return [invoiceNumber, buildInvoiceContext(invoiceNumber, [], [])] as const;
        }
      }),
    );

    setInvoiceContextByNf((previous) => {
      const next = { ...previous };
      contextEntries.forEach(([invoiceNumber, context]) => {
        if (!next[invoiceNumber]) {
          next[invoiceNumber] = context;
        }
      });
      return next;
    });
  }

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
          <DateRow className="grid-cols-[1fr_auto] max-[768px]:grid-cols-1">
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
            <DateAction className="justify-end gap-2 max-[768px]:justify-start">
              <IconButton
                icon={Search}
                label="Buscar notas por periodo"
                onClick={getDanfesByDate}
                className="h-10 w-10 min-h-10 min-w-10 rounded-md"
                size="lg"
              />
              <select
                onChange={filterByRoute}
                className="h-10 min-w-[170px] rounded-sm border border-accent/35 bg-surface-2/85 px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/60 max-[768px]:min-w-0 max-[768px]:flex-1"
                defaultValue="Todas"
              >
                {routes.map((route, index) => (
                  <option value={route} key={`rota-${index}`}>
                    {route}
                  </option>
                ))}
              </select>
            </DateAction>
          </DateRow>
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
