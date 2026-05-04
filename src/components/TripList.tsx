import axios from 'axios';
import { IDanfe, ITrip } from '../types/types';
import ProductListPDF from './ProductListPDF';
import { pdf } from '@react-pdf/renderer';
import { Trash2 } from 'lucide-react';
import { formatDateBR } from '../utils/dateDisplay';
import { API_URL } from '../data';
import { BoxButton, CardHeader, CardTrips, LeftHeader, RightHeader, TripNoteItem, TripNotesContainer, TripNotesList } from '../style/trips';
import { collectTripProductsByNote, groupTripProductsByCodeAndUnit } from '../utils/tripProducts';

interface TripListProps {
  trip: ITrip;
  setIsPrinting: (param: boolean) => void;
  onDeleteTrip: (tripId: number) => Promise<void>;
}

function TripList({ trip, setIsPrinting, onDeleteTrip }: TripListProps) {

  async function fetchDanfes(nf: string) {
    try {
      const { data } = await axios.get(`${API_URL}/danfes/nf/${nf}`);
      return data;
    } catch (error) {
      console.error('Erro ao buscar danfe:', error);
      return null;
    }
  }

  async function handleFetchData() {
    const danfeData = await Promise.all(trip.TripNotes.map(note => fetchDanfes(note.invoice_number)));
    const validDanfes = danfeData.filter((data): data is IDanfe => data !== null);
    return { validDanfes };
  }

  async function handlePrintProductsList() {
    setIsPrinting(true);

    const { validDanfes } = await handleFetchData();
    const allProducts = collectTripProductsByNote(trip.TripNotes || [], validDanfes);

    const groupedProducts = groupTripProductsByCodeAndUnit(allProducts);

    const pdfBlob = await pdf(
      <ProductListPDF products={groupedProducts} danfes={validDanfes} driver={trip.Driver.name} />
    ).toBlob();

    const pdfUrl = URL.createObjectURL(pdfBlob);

    setTimeout(() => {
      window.open(pdfUrl, '_blank');
      setIsPrinting(false);
    }, 3000);
  }

  async function handlePrintDanfes() {
    setIsPrinting(true);

    const { validDanfes } = await handleFetchData();

    const pdfBlob = await pdf(
      <ProductListPDF danfes={validDanfes} driver={trip.Driver.name} />
    ).toBlob();

    const pdfUrl = URL.createObjectURL(pdfBlob);

    setTimeout(() => {
      window.open(pdfUrl, '_blank');
      setIsPrinting(false);
    }, 3000);
  }

  async function handleDeleteTrip() {
    const confirmed = window.confirm(`Deseja excluir a viagem do motorista ${trip.Driver.name}?`);
    if (!confirmed) return;

    try {
      await onDeleteTrip(trip.id);
    } catch (error) {
      console.error('Erro ao excluir viagem:', error);
      alert('Não foi possível excluir a viagem.');
    }
  }

  return (
    <CardTrips>
      <CardHeader>
        <LeftHeader>
          <p>{trip.Driver.name}</p>
          <p>{trip.Car.license_plate}</p>
        </LeftHeader>
        <RightHeader>
          <p>Data: {formatDateBR(trip.date)}</p>
          <p style={{ fontWeight: 'bold' }}>Peso: {trip.gross_weight}</p>
          <p>{`${trip.TripNotes.length} Notas`}</p>
        </RightHeader>
      </CardHeader>

      <TripNotesContainer className="w-[calc(100%-72px)]">
        <TripNotesList>
          {trip.TripNotes.map((note) => (
            <TripNoteItem key={`${note.invoice_number}-${note.order}`}>
              <h5>{note.order}</h5>
              <h4>{note.invoice_number}</h4>
              <p>{note.customer_name}</p>
            </TripNoteItem>
          ))}
        </TripNotesList>
      </TripNotesContainer>

      <button
        type="button"
        aria-label={`Excluir viagem ${trip.id}`}
        title="Excluir viagem"
        onClick={() => void handleDeleteTrip()}
        className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-rose-300/80 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <BoxButton>
        <button onClick={handlePrintProductsList}>Imprimir Lista De Produtos</button>
        <button onClick={handlePrintDanfes}>Imprimir Lista De Entregas</button>
      </BoxButton>
    </CardTrips>
  );
}

export default TripList;
