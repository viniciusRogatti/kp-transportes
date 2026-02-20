import axios from 'axios';
import { ITrip } from '../types/types';
import ProductListPDF from './ProductListPDF';
import { pdf } from '@react-pdf/renderer';
import { formatDateBR } from '../utils/dateDisplay';
import { API_URL } from '../data';
import { BoxButton, CardHeader, CardTrips, LeftHeader, RightHeader, TripNoteItem, TripNotesContainer, TripNotesList } from '../style/trips';

interface TripListProps {
  trip: ITrip;
  setIsPrinting: (param: boolean) => void;
}

function TripList({ trip, setIsPrinting }: TripListProps) {

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

    const validDanfes = danfeData.filter(data => data !== null);
    const allProducts = validDanfes.flatMap(data => data.DanfeProducts);

    return { validDanfes, allProducts };
  }

  async function handlePrintProductsList() {
    setIsPrinting(true);

    const { allProducts } = await handleFetchData();

    const groupedProducts = allProducts.reduce((accumulator: any, product) => {
      const existingProduct = accumulator.find((p: any) => p.Product.code === product.Product.code);
      const quantity = Number(product.quantity || 0);
      if (existingProduct) {
        existingProduct.quantity += quantity;
      } else {
        accumulator.push({ ...product, quantity });
      }
      return accumulator;
    }, []);

    const pdfBlob = await pdf(
      <ProductListPDF products={groupedProducts} driver={trip.Driver.name} />
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

      <TripNotesContainer>
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

      <BoxButton>
        <button onClick={handlePrintProductsList}>Imprimir Lista De Produtos</button>
        <button onClick={handlePrintDanfes}>Imprimir Lista De Entregas</button>
      </BoxButton>
    </CardTrips>
  );
}

export default TripList;
