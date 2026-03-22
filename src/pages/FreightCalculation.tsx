import React, { useState } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { PDFDownloadLink } from '@react-pdf/renderer';
import TripsPDF from '../components/TripsPDF';
import SearchInput from '../components/ui/SearchInput';
import { API_URL } from '../data';
import { ITrip } from '../types/types';
import { formatDateBR } from '../utils/dateDisplay';

const FreightSummary: React.FC = () => {
  const [driverId, setDriverId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [trips, setTrips] = useState<ITrip[]>([]);
  const [freightValues, setFreightValues] = useState<{ [key: number]: number }>({});
  const [tollValue, setTollValue] = useState<number>(0);

  const searchTrips = async () => {
    try {
      const response = await axios.get(`${API_URL}/trips/search/driver/${driverId}`, {
        params: {
          startDate: startDate?.toISOString().split('T')[0],
          endDate: endDate?.toISOString().split('T')[0],
        }
      });
      setTrips(response.data.trips);
    } catch (error) {
      console.error('Erro ao buscar viagens:', error);
    }
  };

  const handleFreightChange = (tripId: number, value: number) => {
    setFreightValues({
      ...freightValues,
      [tripId]: value
    });
  };

  return (
    <div>
      <h1>Resumo de fretes</h1>
      <div>
        <label>ID do motorista:</label>
        <SearchInput
          type="text"
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
          onSearch={searchTrips}
          searchLabel="Buscar viagens"
          placeholder="ID do motorista"
        />
      </div>
      <div>
        <label>Data inicial:</label>
        <DatePicker selected={startDate} onChange={(date: Date) => setStartDate(date)} />
      </div>
      <div>
        <label>Data final:</label>
        <DatePicker selected={endDate} onChange={(date: Date) => setEndDate(date)} />
      </div>
      {trips.length > 0 && (
        <div>
          <h2>Viagens encontradas</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cidades</th>
                <th>Valor do frete</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id}>
                  <td>{formatDateBR(trip.date)}</td>
                  <td>{trip.TripNotes.map(note => note.city).join(', ')}</td>
                  <td>
                    <input
                      type="number"
                      value={freightValues[trip.id] || ''}
                      onChange={(e) => handleFreightChange(trip.id, parseFloat(e.target.value))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <label>Valor total de pedágio:</label>
            <input type="number" value={tollValue} onChange={(e) => setTollValue(parseFloat(e.target.value))} />
          </div>
          <PDFDownloadLink
            document={<TripsPDF trips={trips} freightValues={freightValues} tollValue={tollValue} />}
            fileName="relatorio-fretes.pdf"
          >
            {({ loading }) => (loading ? 'Gerando PDF...' : 'Baixar PDF')}
          </PDFDownloadLink>
        </div>
      )}
    </div>
  );
};

export default FreightSummary;
