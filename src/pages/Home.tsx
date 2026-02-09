import { useEffect, useState } from "react";
import Header from "../components/Header"
import { HomeContent, HomeStyle, OccurrenceCard, OccurrenceList } from "../style/Home";
import verifyToken from "../utils/verifyToken";
import { useNavigate } from "react-router";
import axios from "axios";
import { API_URL } from "../data";
import { IOccurrence } from "../types/types";

function Home() {
  const navigate = useNavigate();
  const [pendingOccurrences, setPendingOccurrences] = useState<IOccurrence[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const fetchToken = async () => {
      if (token) {
        const isValidToken = await verifyToken(token);
        if (!isValidToken) {
          navigate('/');
          return;
        }
        await loadPendingOccurrences();
      } else {
        navigate('/');
      }
    } 
    fetchToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPendingOccurrences() {
    try {
      const { data } = await axios.get(`${API_URL}/occurrences/pending`);
      setPendingOccurrences(data);
    } catch (error) {
      console.error('Erro ao carregar ocorrencias pendentes:', error);
    }
  }

  async function resolveOccurrence(id: number) {
    try {
      await axios.put(`${API_URL}/occurrences/status/${id}`, { status: 'resolved' });
      await loadPendingOccurrences();
    } catch (error) {
      console.error('Erro ao resolver ocorrencia:', error);
      alert('Nao foi possivel atualizar a ocorrencia.');
    }
  }

  return (
    <HomeStyle>
      <Header />
      <HomeContent>
        <OccurrenceCard>
          <h2>Ocorrencias Pendentes</h2>
          {!pendingOccurrences.length ? (
            <p>Nenhuma ocorrencia pendente no momento.</p>
          ) : (
            <OccurrenceList>
              {pendingOccurrences.map((occurrence) => (
                <li key={occurrence.id}>
                  <div>
                    <strong>NF {occurrence.invoice_number}</strong>
                    <p>{occurrence.description}</p>
                    <small>
                      {occurrence.product_id ? `Produto ${occurrence.product_id}` : 'Sem produto vinculado'}
                      {occurrence.quantity ? ` | Qtd ${occurrence.quantity}` : ''}
                    </small>
                  </div>
                  <button onClick={() => resolveOccurrence(occurrence.id)} type="button">
                    Marcar resolvida
                  </button>
                </li>
              ))}
            </OccurrenceList>
          )}
        </OccurrenceCard>
      </HomeContent>
    </HomeStyle>
  )
}

export default Home
