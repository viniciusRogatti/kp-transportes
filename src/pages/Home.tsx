import { useEffect } from "react";
import Header from "../components/Header"
import { HomeStyle } from "../style/Home";
import verifyToken from "../utils/verifyToken";
import { useNavigate } from "react-router";

function Home() {
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
    <HomeStyle>
      <Header />
    </HomeStyle>
  )
}

export default Home