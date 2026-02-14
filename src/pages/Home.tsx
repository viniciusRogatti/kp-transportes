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

      const missingContextOccurrences = (Array.isArray(data) ? data : []).filter((occurrence: IOccurrence) => {
        const invoice = String(occurrence.invoice_number || '').trim();
        const needsContext = !occurrence.customer_name || !occurrence.city || (!occurrence.product_description && !!occurrence.product_id);
        return needsContext && /^\d+$/.test(invoice);
      });

      if (!missingContextOccurrences.length) {
        setPendingOccurrences(data);
        return;
      }

      const fallbackResults = await Promise.all(
        missingContextOccurrences.map(async (occurrence: IOccurrence) => {
          try {
            const { data: danfe } = await axios.get(`${API_URL}/danfes/nf/${occurrence.invoice_number}`);
            const fallbackProductDescription = occurrence.product_description
              || danfe?.DanfeProducts?.find(
                (item: any) => String(item?.Product?.code || '').trim() === String(occurrence.product_id || '').trim(),
              )?.Product?.description
              || null;

            return {
              id: occurrence.id,
              customer_name: danfe?.Customer?.name_or_legal_entity || occurrence.customer_name || null,
              city: danfe?.Customer?.city || occurrence.city || null,
              product_description: fallbackProductDescription,
            };
          } catch {
            return null;
          }
        }),
      );

      const fallbackByOccurrenceId = new Map(
        fallbackResults
          .filter((item): item is NonNullable<typeof item> => !!item)
          .map((item) => [item.id, item]),
      );

      const merged = (Array.isArray(data) ? data : []).map((occurrence: IOccurrence) => {
        const fallback = fallbackByOccurrenceId.get(occurrence.id);
        if (!fallback) return occurrence;
        return {
          ...occurrence,
          customer_name: fallback.customer_name ?? occurrence.customer_name ?? null,
          city: fallback.city ?? occurrence.city ?? null,
          product_description: fallback.product_description ?? occurrence.product_description ?? null,
        };
      });

      setPendingOccurrences(merged);
    } catch (error) {
      console.error('Erro ao carregar ocorrencias pendentes:', error);
    }
  }

  function resolveOccurrence() {
    navigate('/returns-occurrences?tab=occurrences');
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
                    <strong>
                      {`NF: ${occurrence.invoice_number}`}
                      {occurrence.customer_name ? ` | ${occurrence.customer_name}` : ''}
                      {occurrence.city ? ` - ${occurrence.city}` : ''}
                    </strong>
                    <p>{occurrence.description}</p>
                    <small>
                      {occurrence.product_description
                        ? `Produto: ${occurrence.product_description}`
                        : occurrence.product_id
                          ? `Produto ${occurrence.product_id}`
                          : 'Sem produto vinculado'}
                      {occurrence.quantity ? ` | Qtd ${occurrence.quantity}` : ''}
                    </small>
                  </div>
                  <button onClick={resolveOccurrence} type="button">
                    Resolver na aba de ocorrencias
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
