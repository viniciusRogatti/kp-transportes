import React, { useState, useEffect } from "react";
import CardDanfes from "../components/CardDanfes";
import Header from "../components/Header";
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';
import { IDanfe } from "../types/types";
import { ContainerDanfes, ContainerTodayInvoices, FilterBar, NotesFound } from "../style/TodayInvoices";
import ScrollToTopButton from "../components/ScrollToTopButton";

import { cities, routes } from "../data/danfes";
import { API_URL } from "../data";
import { Container } from "../style/invoices";
import verifyToken from "../utils/verifyToken";
import { useNavigate } from "react-router";

function TodayInvoices() {
  const [dataDanfes, setDataDanfes] = useState<IDanfe[] | []>([]);
  const [danfes, setDanfes] = useState<IDanfe[] | []>([]);
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
    loadTodayData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTodayData() {
    try {
      const response = await axios.get(`${API_URL}/danfes`);
      setDanfes(response.data);
      setDataDanfes(response.data);
    } catch (error) {
      console.error('Erro ao buscar notas do dia atual:', error);
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
    <ContainerTodayInvoices>
      <Header />
      <Container>
        <FilterBar>
          <input type="text" onChange={filterByNf} placeholder="Filtrar por NF" />
          <input type="text" onChange={filterByProductCode} placeholder="Filtrar por produto" />
          <input type="text" onChange={filterByCustomerName} placeholder="Filtrar por nome do cliente" />
          <input type="text" onChange={filterByCustomerCity} placeholder="Filtrar por cidade" />
          <div>
            Rotas:
            <select onChange={filterByRoute}>
              {routes.map((route, index) => (
                <option value={route} key={`rota-${index}`}>
                  {route}
                </option>
              ))}
            </select>
          </div>
        </FilterBar>
        {danfes.length === 0 ? (
          <p>Nenhuma nota lançada para hoje!</p>
        ) : (
          <ContainerDanfes>
            <NotesFound>{`${danfes.length} Notas encontradas`}</NotesFound>
            <CardDanfes danfes={danfes} />
          </ContainerDanfes>
        )}
        <ScrollToTopButton />
      </Container>
    </ContainerTodayInvoices>
  )
}

export default TodayInvoices;
