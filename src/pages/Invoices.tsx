import { useEffect, useState } from "react";
import { IDanfe } from "../types/types";
import axios from "axios";
import CardDanfes from "../components/CardDanfes";
import DatePicker, { registerLocale } from "react-datepicker";
import ptBR from 'date-fns/locale/pt-BR';
import { API_URL } from "../data";
import Header from "../components/Header";
import { Container, DateAction, DateGroup, DateRow, SearchBar, SearchButton, SearchRow } from "../style/invoices";
import { FilterBar, NotesFound } from "../style/TodayInvoices";
import { cities, routes } from "../data/danfes";
import { useNavigate } from "react-router";
import verifyToken from "../utils/verifyToken";
registerLocale('ptBR', ptBR);

function Invoices() {
  const [danfes, setDanfes] = useState<IDanfe[]>([]);
  const [dataDanfes, setDataDanfes] = useState<IDanfe[]>([]);
  const [nf, setNf] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const navigate = useNavigate();

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
        setDanfes(data);
        setStartDate(null);
        setEndDate(null);
        setDataDanfes(data);
      } catch (error) {
        console.log('Não foi possível encontrar notas com essas datas');
      }
    }
  }

  function setFilter(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.toLocaleLowerCase();
    setNf(value)
  };

  async function getDanfeByNf () {
    const isDuplicate = danfes.some((danfe) => danfe?.invoice_number === nf);
    if (!isDuplicate) {
      try {
        const { data } = await axios.get(`${API_URL}/danfes/nf/${nf}`);
        
        if (data) {
          setDanfes([...danfes, data]);
        }
        
      } catch (error) {
        console.log('Algo deu errado ao tentar buscar essa nf');
      }
    }
    setNf('');
  };

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

  function filterByProductCode(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.toLowerCase();
    const searchDanfe = dataDanfes.filter((danfe) => danfe.DanfeProducts.some((product) => (
      product.Product.code.toLowerCase().includes(value)
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
  
  return (
    <div>
      <Header />
      <Container>
        <SearchBar>
          <SearchRow>
            <input value={nf} type="number" onChange={setFilter} placeholder="Digite a nf" />
            <SearchButton onClick={getDanfeByNf}>Pesquisar</SearchButton>
          </SearchRow>
          <DateRow>
            <DateGroup>
              <DatePicker
                selected={startDate}
                onChange={date => setStartDate(date)}
                placeholderText="Data de início"
                dateFormat="yyyy-MM-dd"
                locale="ptBR"
                popperPlacement="bottom-start"
                withPortal
              />
              <DatePicker
                selected={endDate}
                onChange={date => setEndDate(date)}
                placeholderText="Data de fim"
                dateFormat="yyyy-MM-dd"
                locale="ptBR"
                popperPlacement="bottom-start"
                withPortal
              />
            </DateGroup>
            <DateAction>
              <SearchButton onClick={getDanfesByDate}>Buscar</SearchButton>
            </DateAction>
          </DateRow>
        </SearchBar>

        <FilterBar>
          <input type="text" onChange={filterByNf} placeholder="Filtrar por NF" />
          <input type="text" onChange={filterByProductCode} placeholder="Filtrar por produto" />
          <input type="text" onChange={filterByCustomerName} placeholder="Filtrar por nome do cliente" />
          <input type="text" onChange={filterByCustomerCity} placeholder="Filtrar por cidade" />
          <div>
            Rotas
            <select onChange={filterByRoute}>
              {routes.map((route, index) => (
                <option value={route} key={`rota-${index}`}>
                  {route}
                </option>
              ))}
            </select>
          </div>
        </FilterBar>
        <NotesFound>{`${danfes.length} Notas encontradas`}</NotesFound>
        <CardDanfes danfes={danfes} />
      </Container>
    </div>
  )
};

export default Invoices;
