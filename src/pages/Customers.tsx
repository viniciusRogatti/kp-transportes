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
            <FilterBar>
              <FilterInput
                type="text"
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder="Filtrar por nome"
              />
              <FilterInput
                type="text"
                value={cityFilter}
                onChange={(event) => setCityFilter(event.target.value)}
                placeholder="Filtrar por cidade"
              />
            </FilterBar>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cidade</th>
                  <th>Estado</th>
                  <th>Telefone</th>
                  <th>CNPJ/CPF</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.cnpj_or_cpf}>
                    <td>{customer.name_or_legal_entity}</td>
                    <td>{customer.city || "-"}</td>
                    <td>{customer.state || "-"}</td>
                    <td>{customer.phone || "-"}</td>
                    <td>{customer.cnpj_or_cpf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Container>
    </div>
  )
}

export default Customers
