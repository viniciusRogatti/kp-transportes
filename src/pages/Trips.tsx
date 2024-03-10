import { useEffect, useState } from "react";
import { ITrip } from "../types/types";
import TripList from "../components/TripList";
import ptBR from 'date-fns/locale/pt-BR';
import { URL } from "../data";
import Header from "../components/Header";
import { Container } from "../style/incoives";
import { BoxSearch, ContainerInputs, ContainerTrips } from "../style/trips";
import DatePicker from "react-datepicker";

const { format } = require('date-fns');

function Trips() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [trips, setTrips] = useState<ITrip[]>([]);

  useEffect(() => {
    loadTodayTrips();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTripsByDate = async (date: string) => {
    const response = await fetch(`${URL}/trips/search/date/${date}`);
    const data = await response.json();
    return data;
  };

  const loadTodayTrips = async () => {
    const result = await fetchTripsByDate(format(new Date(), 'yyyy-MM-dd'));
    setTrips(result);
  };

  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
  };

  const handleSearch = async () => {
    try {  
      const formattedDate = selectedDate?.toISOString().split('T')[0];
      if (formattedDate) {
        const result = await fetchTripsByDate(formattedDate);        
        setTrips(result);
      }  

    } catch (error) {
      console.error("Erro ao buscar viagens:", error);
    }
  };
  
  return (
    <div>
      <Header />
      <Container>
        <ContainerInputs>
          <p>Procurar viagem</p>
          <BoxSearch>
            <DatePicker 
              selected={selectedDate} 
              onChange={handleDateChange}
              dateFormat="dd/MM/yyyy"
              locale={ptBR}       
            />
            <button onClick={handleSearch}>Buscar</button>
          </BoxSearch>
        </ContainerInputs>
        <ContainerTrips>
          { trips?.length > 0 && (
            trips.map((trip, index) => <TripList key={index} trip={trip} />)
          )}
        </ContainerTrips>
      </Container>
    </div>
  );
}

export default Trips;
