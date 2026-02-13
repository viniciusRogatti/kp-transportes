import { useEffect, useState } from "react";
import { IProduct } from "../types/types";
import CardProducts from "../components/CardProducts";
import axios from "axios";
import { API_URL } from "../data";
import Header from "../components/Header";
import { Container, FilterBar, FilterInput } from "../style/invoices";
import verifyToken from "../utils/verifyToken";
import { useNavigate } from "react-router";
import { ProductsLoader } from "../style/Loaders";

function Products() {
  const [products, setProduct] = useState<IProduct[] | []>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [codeFilter, setCodeFilter] = useState("");
  const [descriptionFilter, setDescriptionFilter] = useState("");

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
    loadProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProducts() {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_URL}/products`);
      const data = response.data.sort((a: IProduct, b: IProduct) => a.description.localeCompare(b.description));
      setProduct(data);
      setTimeout(()=> {
        setIsLoading(false);
      }, 2000)
    } catch (error) {
      console.error('Erro ao buscar os produtos:', error);
    }
  }

  const filteredProducts = products.filter((product) => {
    const matchesCode = product.code
      .toString()
      .toLowerCase()
      .includes(codeFilter.trim().toLowerCase());
    const matchesDescription = product.description
      .toLowerCase()
      .includes(descriptionFilter.trim().toLowerCase());
    return matchesCode && matchesDescription;
  });

  return (
    <div>
      <Header />
      <Container>
      {isLoading ? (<ProductsLoader />) : (
        <>
          <FilterBar className="max-[768px]:grid-cols-1 max-[768px]:[grid-template-columns:minmax(0,1fr)]">
            <FilterInput
              type="text"
              value={codeFilter}
              onChange={(event) => setCodeFilter(event.target.value)}
              placeholder="Filtrar por codigo"
              className="max-w-full"
            />
            <FilterInput
              type="text"
              value={descriptionFilter}
              onChange={(event) => setDescriptionFilter(event.target.value)}
              placeholder="Filtrar por descricao"
              className="max-w-full"
            />
          </FilterBar>
          <div className="w-full max-w-[1200px] overflow-x-auto">
            <table className="min-w-[640px] max-[768px]:min-w-[540px] max-[768px]:[&_td:nth-child(2)]:text-[0.78rem]">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th className="max-[768px]:hidden">Preço</th>
                  <th className="max-[768px]:hidden">Tipo</th>
                </tr>
              </thead>
              <tbody>
                { filteredProducts.map((product) => <CardProducts product={product} />)}
              </tbody>
            </table>
          </div>
        </>
      )}
      </Container>
    </div>

  )
}

export default Products;

//const data = response.data.sort((a: IProduct, b: IProduct) => a.description.localeCompare(b.description));
