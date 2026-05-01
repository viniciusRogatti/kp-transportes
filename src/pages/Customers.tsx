import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header"
import { Container, FilterBar, FilterInput } from "../style/invoices"
import verifyToken from "../utils/verifyToken";
import { useNavigate } from "react-router";
import axios from "axios";
import { API_URL } from "../data";
import { ICustomer } from "../types/types";
import { ProductsLoader } from "../style/Loaders";

type CustomerWithOptionalNumber = ICustomer & {
  address_number?: string | number | null;
  number?: string | number | null;
  nro?: string | number | null;
};

const COMPANY_TAB_ORDER = ['mar_e_rio', 'brazilian_fish', 'pronto'] as const;

const COMPANY_LABELS: Record<string, string> = {
  all: 'Todas',
  mar_e_rio: 'MAR E RIO',
  brazilian_fish: 'BRASFISH',
  pronto: 'PRONTO',
};

const resolveCompanyCode = (customer: ICustomer) => String(customer.company?.code || '').trim().toLowerCase();

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string) {
  return normalizeSpaces(value)
    .split(" ")
    .map((chunk) => {
      const lower = chunk.toLocaleLowerCase("pt-BR");
      if (!lower) return lower;
      return `${lower.charAt(0).toLocaleUpperCase("pt-BR")}${lower.slice(1)}`;
    })
    .join(" ");
}

function removeRepeatedStreetPrefix(value: string) {
  const normalized = normalizeSpaces(value);
  const tokens = normalized.split(" ");
  if (tokens.length >= 2 && tokens[0].toLocaleLowerCase("pt-BR") === tokens[1].toLocaleLowerCase("pt-BR")) {
    return tokens.slice(1).join(" ");
  }
  return normalized;
}

function getOptionalAddressNumber(customer: CustomerWithOptionalNumber) {
  const candidates = [customer.address_number, customer.number, customer.nro];
  const found = candidates.find((value) => value !== null && value !== undefined && String(value).trim() !== "");
  return found ? String(found).trim() : "";
}

function formatRepresentativeName(value?: string | null) {
  const normalized = normalizeSpaces(String(value || ""));
  return normalized || "-";
}

function formatAddress(customer: CustomerWithOptionalNumber) {
  const neighborhood = normalizeSpaces(String(customer.neighborhood || ""));

  if (!customer.address && !neighborhood) return "-";

  const streetValue = customer.address ? removeRepeatedStreetPrefix(customer.address) : "";
  const formattedStreet = streetValue ? toTitleCase(streetValue) : "";
  const optionalNumber = getOptionalAddressNumber(customer);

  let baseAddress = formattedStreet;
  if (optionalNumber && formattedStreet) {
    const hasNumberAlready = /\b\d+[A-Za-z]?\b|s\/n\b/i.test(formattedStreet);
    if (!hasNumberAlready) {
      baseAddress = `${formattedStreet}, ${optionalNumber}`;
    }
  }

  const formattedNeighborhood = neighborhood ? toTitleCase(neighborhood) : "";
  if (!baseAddress) return formattedNeighborhood || "-";
  if (!formattedNeighborhood) return baseAddress;

  return `${baseAddress} - ${formattedNeighborhood}`;
}

function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [activeCompanyTab, setActiveCompanyTab] = useState<string>('all');

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

  const visibleCustomers = useMemo(() => {
    if (activeCompanyTab === 'all') return customers;
    return customers.filter((customer) => resolveCompanyCode(customer) === activeCompanyTab);
  }, [activeCompanyTab, customers]);

  const filteredCustomers = visibleCustomers.filter((customer) => {
    const name = (customer.name_or_legal_entity || "").toLowerCase();
    const city = (customer.city || "").toLowerCase();
    return name.includes(nameFilter.trim().toLowerCase())
      && city.includes(cityFilter.trim().toLowerCase());
  });
  
  return (
    <div>
      <Header />
      <Container className="max-[768px]:[&_table]:text-[0.75rem] max-[768px]:[&_th]:text-[0.7rem] max-[768px]:[&_td]:text-[0.75rem]">
        {isLoading ? (
          <ProductsLoader />
        ) : (
          <>
            <div className="mb-s4 flex w-full justify-start">
              <div className="relative inline-flex max-w-full flex-wrap items-end rounded-t-xl border border-border bg-card px-1 pt-1 shadow-soft">
                {COMPANY_TAB_ORDER.map((companyCode) => (
                  <button
                    key={companyCode}
                    type="button"
                    onClick={() => setActiveCompanyTab(companyCode)}
                    className={`relative -mb-px rounded-t-[10px] border px-4 py-2 text-sm font-semibold transition ${
                      activeCompanyTab === companyCode
                        ? 'border-border border-b-transparent bg-card text-text shadow-soft'
                        : 'border-transparent bg-surface/70 text-muted hover:bg-surface-2/70 hover:text-text'
                    }`}
                  >
                    {COMPANY_LABELS[companyCode] || companyCode}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setActiveCompanyTab('all')}
                  className={`relative -mb-px rounded-t-[10px] border px-4 py-2 text-sm font-semibold transition ${
                    activeCompanyTab === 'all'
                      ? 'border-border border-b-transparent bg-card text-text shadow-soft'
                      : 'border-transparent bg-surface/70 text-muted hover:bg-surface-2/70 hover:text-text'
                  }`}
                >
                  Todas
                </button>
              </div>
            </div>
            <FilterBar className="max-[768px]:grid-cols-1 max-[768px]:[grid-template-columns:minmax(0,1fr)]">
              <FilterInput
                type="text"
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder="Filtrar por nome"
                className="max-w-full max-[768px]:h-9 max-[768px]:text-[0.8rem]"
              />
              <FilterInput
                type="text"
                value={cityFilter}
                onChange={(event) => setCityFilter(event.target.value)}
                placeholder="Filtrar por cidade"
                className="max-w-full max-[768px]:h-9 max-[768px]:text-[0.8rem]"
              />
            </FilterBar>
            <div className="mb-s4 flex w-full max-w-[1200px] items-center justify-between text-sm text-muted">
              <span>
                {activeCompanyTab === 'all'
                  ? `${filteredCustomers.length} cliente(s) em todas as empresas`
                  : `${filteredCustomers.length} cliente(s) em ${COMPANY_LABELS[activeCompanyTab] || activeCompanyTab}`}
              </span>
            </div>
            <div className="w-full max-w-[1200px] overflow-x-auto">
              <table className="min-w-[920px] max-[768px]:min-w-[720px] max-[768px]:[&_td]:leading-snug max-[768px]:[&_th]:leading-tight">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Representante</th>
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
                      <td>{toTitleCase(customer.name_or_legal_entity || "-")}</td>
                      <td>{formatRepresentativeName(customer.representative_name)}</td>
                      <td className="max-[768px]:text-[0.72rem] max-[768px]:leading-snug">{formatAddress(customer)}</td>
                      <td>{customer.city ? toTitleCase(customer.city) : "-"}</td>
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
