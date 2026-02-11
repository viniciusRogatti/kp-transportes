import React, { useState, useEffect } from "react";
import CardDanfes from "../components/CardDanfes";
import Header from "../components/Header";
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';
import { IDanfe, IDanfeProduct, IGroupedProduct } from "../types/types";
import { ContainerDanfes, ContainerTodayInvoices, FilterBar, NotesFound } from "../style/TodayInvoices";
import ScrollToTopButton from "../components/ScrollToTopButton";
import TodayProductList from "../components/TodayProductList";
import { cities, routes } from "../data/danfes";
import { API_URL } from "../data";
import { Container } from "../style/invoices";
import verifyToken from "../utils/verifyToken";
import { useNavigate } from "react-router";
import { pdf } from "@react-pdf/renderer";
import { LoaderPrinting } from "../style/Loaders";

function TodayInvoices() {
  const [dataDanfes, setDataDanfes] = useState<IDanfe[]>([]);
  const [danfes, setDanfes] = useState<IDanfe[]>([]);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
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

  function filterByProduct(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.toLowerCase();
    const searchDanfe = dataDanfes.filter((danfe) => danfe.DanfeProducts.some((product) => (
      product.Product.code.toLowerCase().includes(value)
      || product.Product.description.toLowerCase().includes(value)
    )));
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

  function filterByRoute(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === 'Todas') return setDanfes(dataDanfes);
    else {
      const searchDanfe = dataDanfes.filter((danfe) => cities[danfe.Customer.city] === value);
      setDanfes(searchDanfe);
    }
  }

  function getGroupedProducts(dataDanfes: IDanfe[]): IGroupedProduct[] {
    const allProducts = dataDanfes.flatMap(danfe => danfe.DanfeProducts);
    const groupedProducts = allProducts.reduce((accumulator: IGroupedProduct[], product: IDanfeProduct) => {
      const existingProduct = accumulator.find(p => p.Product.code === product.Product.code);
      if (existingProduct) {
        existingProduct.quantity += product.quantity;
      } else {
        accumulator.push({
          quantity: product.quantity,
          Product: product.Product
        });
      }
      return accumulator;
    }, []);
  
    // Ordenar os produtos por quantidade em ordem decrescente
    return groupedProducts.sort((a, b) => b.quantity - a.quantity);
  }

  const groupedProducts = getGroupedProducts(dataDanfes);

  async function openPDFInNewTab() {
    setIsPrinting(true);
    const blob = await pdf(<TodayProductList products={groupedProducts} />).toBlob();
    const url = URL.createObjectURL(blob);
    
    setTimeout(() => {
      window.open(url);
      setIsPrinting(false);
    }, 3000);
  }

  const notesSignature = `${danfes.length}-${danfes[0]?.barcode ?? 'none'}-${danfes[danfes.length - 1]?.barcode ?? 'none'}`;

  return (
    <ContainerTodayInvoices>
      <Header />
      <Container>
        <FilterBar>
          <input type="text" onChange={filterByNf} placeholder="Filtrar por NF" />
          <input type="text" onChange={filterByProduct} placeholder="Filtrar produto (cód. ou descrição)" />
          <input type="text" onChange={filterByCustomerName} placeholder="Filtrar por nome do cliente" />
          <input type="text" onChange={filterByCustomerCity} placeholder="Filtrar por cidade" />
          <div className="route-filter">
            Rotas:
            <select onChange={filterByRoute}>
              {routes.map((route, index) => (
                <option value={route} key={`rota-${index}`}>
                  {route}
                </option>
              ))}
            </select>
          </div>
          { danfes.length > 0 && <button onClick={openPDFInNewTab}>Abrir Lista de Produtos</button>}
        </FilterBar>
        {danfes.length === 0 ? (
          <p>Nenhuma nota lançada para hoje!</p>
        ) : (
          <ContainerDanfes> 
            { isPrinting ? (
              <LoaderPrinting />
            ) : (
              <>
                <NotesFound key={notesSignature}>{`${danfes.length} Notas encontradas`}</NotesFound>
                <CardDanfes danfes={danfes} animationKey={notesSignature} />
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
