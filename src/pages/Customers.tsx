import { useEffect } from "react";
import Header from "../components/Header"
import { Container } from "../style/invoices"
import verifyToken from "../utils/verifyToken";
import { useNavigate } from "react-router";

function Customers() {
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
  
  return (
    <div>
      <Header />
      <Container>
         <p>CLIENTES</p>
      </Container>
    </div>
  )
}

export default Customers