import { useEffect, useState } from "react";
import Header from "../components/Header"
import { Container, FilterBar, FilterInput } from "../style/invoices"
import verifyToken from "../utils/verifyToken";
import { useNavigate } from "react-router";
import axios from "axios";
import { API_URL } from "../data";
import { ICustomer } from "../types/types";
import { ProductsLoader } from "../style/Loaders";

function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

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
    loadCustomers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCustomers() {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_URL}/customers`);
      setCustomers(response.data);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredCustomers = customers.filter((customer) => {
    const name = (customer.name_or_legal_entity || "").toLowerCase();
    const city = (customer.city || "").toLowerCase();
    return name.includes(nameFilter.trim().toLowerCase())
      && city.includes(cityFilter.trim().toLowerCase());
  });
  
  return (
    <div>
      <Header />
      <Container>
        {isLoading ? (
          <ProductsLoader />
        ) : (
          <>
            <FilterBar className="max-[768px]:grid-cols-1 max-[768px]:[grid-template-columns:minmax(0,1fr)]">
              <FilterInput
                type="text"
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder="Filtrar por nome"
                className="max-w-full"
              />
              <FilterInput
                type="text"
                value={cityFilter}
                onChange={(event) => setCityFilter(event.target.value)}
                placeholder="Filtrar por cidade"
                className="max-w-full"
              />
            </FilterBar>
            <div className="w-full max-w-[1200px] overflow-x-auto">
              <table className="min-w-[760px] max-[768px]:min-w-[560px] max-[768px]:[&_td]:text-[0.78rem] max-[768px]:[&_td]:leading-snug max-[768px]:[&_th]:text-[0.74rem]">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Endereço</th>
                    <th>Cidade</th>
                    <th className="max-[768px]:hidden">Estado</th>
                    <th>Telefone</th>
                    <th className="max-[768px]:hidden">CNPJ/CPF</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.cnpj_or_cpf}>
                      <td>{customer.name_or_legal_entity}</td>
                      <td className="max-[768px]:text-[0.74rem] max-[768px]:leading-snug">{customer.address || "-"}</td>
                      <td>{customer.city || "-"}</td>
                      <td className="max-[768px]:hidden">{customer.state || "-"}</td>
                      <td>{customer.phone || "-"}</td>
                      <td className="max-[768px]:hidden">{customer.cnpj_or_cpf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Container>
    </div>
  )
}

export default Customers
