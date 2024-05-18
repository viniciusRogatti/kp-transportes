import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import { useNavigate } from "react-router";
import { format } from 'date-fns';

import { ITrip } from "../types/types";
import TripList from "../components/TripList";
import ptBR from 'date-fns/locale/pt-BR';
import { API_URL } from "../data";
import Header from "../components/Header";
import { Container } from "../style/incoives";
import { BoxSearch, ContainerInputs, ContainerTrips } from "../style/trips";
import axios from "axios";
import verifyToken from "../utils/verifyToken";
import transformDate from "../utils/transformDate";

function Trips() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [trips, setTrips] = useState<ITrip[]>([]);
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
    loadTodayTrips();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTripsByDate = async (date: string) => {  
    try {
      console.log(date);
      const response = await axios.get(`${API_URL}/trips/search/date/${date}`);
      
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar viagens do dia atual:', error);
    }  
  };

  const loadTodayTrips = async () => {
    const today = format(new Date(), 'dd-MM-yyyy');
    
    const result = await fetchTripsByDate(today);
    if (result) {
      setTrips(result);
    }
  };

  const handleDateChange = (date: any) => {    
    setSelectedDate(date);
  };

  const handleSearch = async () => {
    try {  
      const dateToString = selectedDate?.toISOString().split('T')[0];
      if (dateToString) {
        const date = transformDate(dateToString);        
        const result = await fetchTripsByDate(date);        
        if (result) {
          setTrips(result);
        }
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
