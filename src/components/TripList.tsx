import { useState } from 'react';
import axios from 'axios';
import { IDanfe, ITrip } from '../types/types';
import ProductListPDF from './ProductListPDF'; // Importe o componente ProductListPDF
import { pdf } from '@react-pdf/renderer';
import transformDate from '../utils/transformDate';
import { API_URL } from '../data';
import { CardHeader, CardTrips, LeftHeader, RightHeader, TripNoteItem, TripNotesContainer, TripNotesList } from '../style/trips';

interface TripListProps {
  trip: ITrip;
}

function TripList({ trip }: TripListProps) {
  const [products, setProducts] = useState<any[]>([]); // Estado para armazenar os produtos 
  const [danfes, setDanfes] = useState<IDanfe[] | []>([]); //

  // Função para buscar os produtos de uma nota fiscal específica
  async function fetchProducts(invoiceNumber: string) {
    try {
      const response = await axios.get(`${API_URL}/products/${invoiceNumber}`);
      const productsData = response.data;
      // Adicionar produtos ao estado
      setProducts((prevProducts) => [...prevProducts, ...productsData]);
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
    }
  }

  async function fetchDanfes(nf: string) {
    try {
      const { data } = await axios.get(`${API_URL}/danfes/nf/${nf}`);
      if (data) {
        setDanfes((prevDanfes) => [...prevDanfes, data]);
      }
    } catch (error) {
      console.error('Erro ao buscar danfe:', error);
    }
  }

  // Função para lidar com o clique no botão "Imprimir Lista de Produtos"
  async function handlePrintProductsList() {
    
    trip.TripNotes.forEach((note) => {
      fetchProducts(note.invoice_number);
      fetchDanfes(note.invoice_number);
    });

    const groupedProducts = products.reduce((accumulator: any, product) => {
      const existingProduct = accumulator.find((p: any) => p.Product.code === product.Product.code);
      if (existingProduct) {
        existingProduct.quantity += product.quantity;
      } else {
        accumulator.push({ ...product });
      }
      return accumulator;
    }, []);

    // Renderize o PDF
    const pdfBlob = await pdf(<ProductListPDF danfes={danfes} products={groupedProducts} driver={trip.Driver.name} />).toBlob();
  
    // Criar um URL a partir do blob
    const pdfUrl = URL.createObjectURL(pdfBlob);
  
    // Abrir o URL em uma nova aba
    window.open(pdfUrl, '_blank');
  
    // Não é mais necessário usar saveAs para fazer o download
  }

  return (
    <CardTrips>
      <CardHeader>
        <LeftHeader>
          <p>{trip.Driver.name}</p>
          <p>{trip.Car.license_plate}</p>
        </LeftHeader>
        <RightHeader>
          <p>Data: {transformDate(trip.date)}</p>
          <p style={{ fontWeight: 'bold' }}>Peso: {trip.gross_weight}</p>
          <p>{`${trip.TripNotes.length} Notas`}</p>
        </RightHeader>
      </CardHeader>

      <TripNotesContainer>
        <TripNotesList>
          {trip.TripNotes.map((note) => (
            <TripNoteItem key={`${note.invoice_number}-${note.order}`}>
              <h4>NF: {note.invoice_number}</h4>
              <p>STATUS: {note.status}</p>
              <p>ORDEM: {note.order}</p>
            </TripNoteItem>
          ))}
        </TripNotesList>
      </TripNotesContainer>

      <button onClick={handlePrintProductsList}>Imprimir Lista De Produtos</button>
    </CardTrips>
  );
}

export default TripList;
