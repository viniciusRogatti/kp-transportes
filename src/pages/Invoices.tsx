import { useState } from "react";
import { IDanfe } from "../types/types";
import axios from "axios";
import CardDanfes from "../components/CardDanfes";
import DatePicker, { registerLocale } from "react-datepicker";
import ptBR from 'date-fns/locale/pt-BR';
import { API_URL } from "../data";
import Header from "../components/Header";
import { Container } from "../style/incoives";
registerLocale('ptBR', ptBR);

function Invoices() {
  const [danfes, setDanfes] = useState<IDanfe[]>([]);
  const [nf, setNf] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
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
  
  return (
    <div>
      <Header />
      <Container>
        <div>
          <input value={nf} type="number" onChange={setFilter} placeholder="Digite a nf" />
          <button onClick={getDanfeByNf}>Pesquisar</button>
        </div>
        <div>
          <DatePicker
            selected={startDate}
            onChange={date => setStartDate(date)}
            placeholderText="Data de início"
            dateFormat="yyyy-MM-dd"
            locale="ptBR"
          />
          <DatePicker
            selected={endDate}
            onChange={date => setEndDate(date)}
            placeholderText="Data de fim"
            dateFormat="yyyy-MM-dd"
            locale="ptBR"
          />
          <button onClick={getDanfesByDate}>Buscar DANFEs</button>
        </div>
      </Container>
      <CardDanfes danfes={danfes} />
    </div>
  )
};

export default Invoices;
