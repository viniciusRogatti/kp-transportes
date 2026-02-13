import React, { useMemo, useState, useEffect } from "react";
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
import { format } from "date-fns";

function TodayInvoices() {
  const [dataDanfes, setDataDanfes] = useState<IDanfe[]>([]);
  const [driverByInvoice, setDriverByInvoice] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState({
    nf: '',
    product: '',
    customer: '',
    city: '',
    route: 'Todas',
    driver: '',
    load: '',
  });
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
      setDataDanfes(response.data);
      await loadTodayDrivers();
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

  const danfes = useMemo(() => {
    return dataDanfes.filter((danfe) => {
      const nfTerm = filters.nf.trim();
      const productTerm = filters.product.trim().toLowerCase();
      const customerTerm = filters.customer.trim().toLowerCase();
      const cityTerm = filters.city.trim().toLowerCase();
      const driverTerm = filters.driver.trim().toLowerCase();
      const loadTerm = filters.load.trim().toLowerCase();

      if (nfTerm && !String(danfe.invoice_number).includes(nfTerm)) return false;

      if (productTerm) {
        const hasProduct = danfe.DanfeProducts.some((product) => (
          product.Product.code.toLowerCase().includes(productTerm)
          || product.Product.description.toLowerCase().includes(productTerm)
        ));
        if (!hasProduct) return false;
      }

      if (customerTerm && !danfe.Customer.name_or_legal_entity.toLowerCase().includes(customerTerm)) return false;
      if (cityTerm && !danfe.Customer.city.toLowerCase().includes(cityTerm)) return false;
      if (filters.route !== 'Todas' && cities[danfe.Customer.city] !== filters.route) return false;

      if (driverTerm) {
        const driver = String(driverByInvoice[String(danfe.invoice_number)] || '').toLowerCase();
        if (!driver.includes(driverTerm)) return false;
      }

      if (loadTerm) {
        const loadNumber = String(danfe.load_number || '').toLowerCase();
        if (!loadNumber.includes(loadTerm)) return false;
      }

      return true;
    });
  }, [dataDanfes, driverByInvoice, filters]);

  const activeFilters = useMemo(() => {
    const entries: Array<{ key: keyof typeof filters; label: string }> = [];
    if (filters.nf.trim()) entries.push({ key: 'nf', label: `NF: ${filters.nf.trim()}` });
    if (filters.product.trim()) entries.push({ key: 'product', label: `Produto: ${filters.product.trim()}` });
    if (filters.customer.trim()) entries.push({ key: 'customer', label: `Cliente: ${filters.customer.trim()}` });
    if (filters.city.trim()) entries.push({ key: 'city', label: `Cidade: ${filters.city.trim()}` });
    if (filters.route !== 'Todas') entries.push({ key: 'route', label: `Rota: ${filters.route}` });
    if (filters.driver.trim()) entries.push({ key: 'driver', label: `Motorista: ${filters.driver.trim()}` });
    if (filters.load.trim()) entries.push({ key: 'load', label: `Carga: ${filters.load.trim()}` });
    return entries;
  }, [filters]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilter(key: keyof typeof filters) {
    setFilters((prev) => ({ ...prev, [key]: key === 'route' ? 'Todas' : '' }));
  }

  function resetFilters() {
    setFilters({
      nf: '',
      product: '',
      customer: '',
      city: '',
      route: 'Todas',
      driver: '',
      load: '',
    });
  }

  function getGroupedProducts(dataDanfes: IDanfe[]): IGroupedProduct[] {
    const allProducts = dataDanfes.flatMap(danfe => danfe.DanfeProducts);
    const groupedProducts = allProducts.reduce((accumulator: IGroupedProduct[], product: IDanfeProduct) => {
      const existingProduct = accumulator.find(p => p.Product.code === product.Product.code);
      const quantity = Number(product.quantity || 0);
      if (existingProduct) {
        existingProduct.quantity += quantity;
      } else {
        accumulator.push({
          quantity,
          Product: product.Product
        });
      }
      return accumulator;
    }, []);
  
    // Ordenar os produtos por quantidade em ordem decrescente
    return groupedProducts.sort((a, b) => b.quantity - a.quantity);
  }

  const groupedProducts = getGroupedProducts(danfes);

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
          <input type="text" value={filters.nf} onChange={(event) => updateFilter('nf', event.target.value)} placeholder="Filtrar por NF" />
          <input type="text" value={filters.product} onChange={(event) => updateFilter('product', event.target.value)} placeholder="Filtrar produto (cód. ou descrição)" />
          <input type="text" value={filters.customer} onChange={(event) => updateFilter('customer', event.target.value)} placeholder="Filtrar por nome do cliente" />
          <input type="text" value={filters.city} onChange={(event) => updateFilter('city', event.target.value)} placeholder="Filtrar por cidade" />
          <input type="text" value={filters.load} onChange={(event) => updateFilter('load', event.target.value)} placeholder="Filtrar por carga" />
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
          { danfes.length > 0 && <button onClick={openPDFInNewTab}>Abrir Lista de Produtos</button>}
        </FilterBar>
        <div className="mb-s3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-border bg-surface/80 px-3 py-1 text-text">
            {activeFilters.length} filtro(s) ativo(s)
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
          <span className="text-muted">Lista de produtos baseada nos filtros atuais.</span>
        </div>
        {danfes.length === 0 ? (
          <p>Nenhuma nota lançada para hoje!</p>
        ) : (
          <ContainerDanfes> 
            { isPrinting ? (
              <LoaderPrinting />
            ) : (
              <>
                <NotesFound key={notesSignature}>{`${danfes.length} Notas encontradas`}</NotesFound>
                <CardDanfes danfes={danfes} animationKey={notesSignature} driverByInvoice={driverByInvoice} />
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
