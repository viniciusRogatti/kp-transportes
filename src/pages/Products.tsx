import { useEffect, useState } from "react";
import { IProduct } from "../types/types";
import CardProducts from "../components/CardProducts";
import axios from "axios";
import { API_URL } from "../data";
import Header from "../components/Header";
import { Container } from "../style/invoices";
import verifyToken from "../utils/verifyToken";
import { useNavigate } from "react-router";

function Products() {
  const [products, setProduct] = useState<IProduct[] | []>([]);

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
      const response = await axios.get(`${API_URL}/products`);
      const data = response.data.sort((a: IProduct, b: IProduct) => a.description.localeCompare(b.description));
      setProduct(data);
    } catch (error) {
      console.error('Erro ao buscar os produtos:', error);
    }
  }


  return (
    <div>
      <Header />
      <Container>
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Preço</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            { products.map((product) => <CardProducts product={product} />)}
          </tbody>
        </table>
      </Container>
    </div>

  )
}

export default Products;

//const data = response.data.sort((a: IProduct, b: IProduct) => a.description.localeCompare(b.description));
