import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ITrip } from '../types/types';
import ProductListPDF from './ProductListPDF'; // Importe o componente ProductListPDF
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import transformDate from '../utils/transformDate';
import { URL } from '../data';
import { CardHeader, CardTrips, LeftHeader, RightHeader, TripNoteItem, TripNotesContainer, TripNotesList } from '../style/trips';

interface TripListProps {
  trip: ITrip;
}

function TripList({ trip }: TripListProps) {
  const [products, setProducts] = useState<any[]>([]); // Estado para armazenar os produtos 

  // Função para buscar os produtos de uma nota fiscal específica
  async function fetchProducts(invoiceNumber: string) {
    try {
      const response = await axios.get(`${URL}/products/${invoiceNumber}`);
      const productsData = response.data;
      // Adicionar produtos ao estado
      setProducts((prevProducts) => [...prevProducts, ...productsData]);
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
    }
  }

  // Função para lidar com o clique no botão "Imprimir Lista de Produtos"
  async function handlePrintProductsList() {
    // Agrupar produtos pelo código do produto e calcular a quantidade total de cada produto
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
    const pdfBlob = await pdf(<ProductListPDF products={groupedProducts} driver={trip.Driver.name} />).toBlob();
    saveAs(pdfBlob, `${trip.Driver.name}_${trip.id}-${transformDate(trip.date)}`);
  }

  // UseEffect para buscar os produtos quando o componente for montado
  useEffect(() => {
    trip.TripNotes.forEach((note) => {
        fetchProducts(note.invoice_number);
      });
  }, [trip]);

  return (
<CardTrips>
      <CardHeader>
        <LeftHeader>
          <p>Motorista: {trip.Driver.name}</p>
          <p>Carro: {trip.Car.model}</p>
        </LeftHeader>
        <RightHeader>
          <p>Data: {transformDate(trip.date)}</p>
          <p style={{ fontWeight: 'bold' }}>Peso Bruto: {trip.gross_weight}</p>
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
