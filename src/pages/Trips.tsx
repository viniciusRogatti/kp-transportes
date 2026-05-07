import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { useNavigate } from "react-router";
import { RotateCcw } from "lucide-react";

import { ITrip } from "../types/types";
import TripList from "../components/TripList";
import ptBR from 'date-fns/locale/pt-BR';
import { API_URL } from "../data";
import Header from "../components/Header";
import IconButton from "../components/ui/IconButton";
import { Container, FilterBar, FilterInput } from "../style/invoices";
import { BoxSearch, ContainerInputs, ContainerTrips } from "../style/trips";
import axios from "axios";
import verifyToken from "../utils/verifyToken";
import transformDate from "../utils/transformDate";
import { LoaderPrinting } from '../style/Loaders';

type TripFilters = {
  tripId: string;
  driverName: string;
  licensePlate: string;
  invoiceNumber: string;
};

const createEmptyFilters = (): TripFilters => ({
  tripId: '',
  driverName: '',
  licensePlate: '',
  invoiceNumber: '',
});

const normalizeText = (value: string) => value.trim().toLowerCase();

function Trips() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [allTrips, setAllTrips] = useState<ITrip[]>([]);
  const navigate = useNavigate();
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [filters, setFilters] = useState<TripFilters>(createEmptyFilters());

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
    void loadTripsByDate(new Date());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTripsByDate = async (date: string) => {
    try {
      const response = await axios.get(`${API_URL}/trips/search/date/${date}`);
      return response.data || [];
    } catch (error) {
      console.error('Erro ao buscar viagens:', error);
      return [];
    }  
  };

  const applyClientSideFilters = (rows: ITrip[], currentFilters: TripFilters) => {
    const normalizedTripId = currentFilters.tripId.trim();
    const normalizedDriverName = normalizeText(currentFilters.driverName);
    const normalizedLicensePlate = normalizeText(currentFilters.licensePlate);
    const normalizedInvoiceNumber = normalizeText(currentFilters.invoiceNumber);

    return rows.filter((trip) => (
      (!normalizedTripId || String(trip.id).includes(normalizedTripId))
      && (
        !normalizedDriverName
        || normalizeText(String(trip.Driver?.name || '')).includes(normalizedDriverName)
        || (trip.TripNotes || []).some((note) => normalizeText(String(note.customer_name || '')).includes(normalizedDriverName))
      )
      && (!normalizedLicensePlate || normalizeText(String(trip.Car?.license_plate || '')).includes(normalizedLicensePlate))
      && (
        !normalizedInvoiceNumber
        || (trip.TripNotes || []).some((note) => (
          normalizeText(String(note.invoice_number || '')).includes(normalizedInvoiceNumber)
        ))
      )
    ));
  };

  const filteredTrips = useMemo(() => (
    applyClientSideFilters(allTrips, filters)
  ), [allTrips, filters]);

  const updateFilter = (key: keyof TripFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const loadTripsByDate = async (date: Date | null) => {
    if (!date) {
      setAllTrips([]);
      return;
    }

    const dateToString = date.toISOString().split('T')[0];
    const transformedDate = transformDate(dateToString);
    const result = await fetchTripsByDate(transformedDate);
    setAllTrips(result);
  };

  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
    void loadTripsByDate(date);
  };

  const handleResetFilters = async () => {
    const today = new Date();
    const emptyFilters = createEmptyFilters();
    setFilters(emptyFilters);
    setSelectedDate(today);
    await loadTripsByDate(today);
  };

  const setPrinting = (param: boolean) => {
    setIsPrinting(param);
  }

  const handleDeleteTrip = async (tripId: number) => {
    await axios.delete(`${API_URL}/trips/delete/${tripId}`);
    setAllTrips((current) => current.filter((trip) => trip.id !== tripId));
  };

  return (
    <div>
      <Header />
      <Container>
        {isPrinting ? (
          <LoaderPrinting />
        ) : (
          <>
            <ContainerInputs className="max-w-[960px] items-stretch">
              <p>Filtros de viagem</p>
              <FilterBar className="mt-s3 max-w-[960px]">
                <FilterInput
                  type="text"
                  value={filters.tripId}
                  onChange={(event) => updateFilter('tripId', event.target.value.replace(/\D/g, ''))}
                  placeholder="Filtrar por ID da viagem"
                />
                <FilterInput
                  type="text"
                  value={filters.driverName}
                  onChange={(event) => updateFilter('driverName', event.target.value)}
                  placeholder="Filtrar por motorista"
                />
                <FilterInput
                  type="text"
                  value={filters.licensePlate}
                  onChange={(event) => updateFilter('licensePlate', event.target.value.toUpperCase())}
                  placeholder="Filtrar por placa"
                />
                <FilterInput
                  type="text"
                  value={filters.invoiceNumber}
                  onChange={(event) => updateFilter('invoiceNumber', event.target.value.replace(/\D/g, ''))}
                  placeholder="Filtrar por NF"
                />
              </FilterBar>
              <BoxSearch>
                <DatePicker 
                  selected={selectedDate} 
                  onChange={handleDateChange}
                  dateFormat="dd/MM/yyyy"
                  locale={ptBR}
                  className="date-picker-input"
                />
                <IconButton
                  icon={RotateCcw}
                  label="Limpar filtros"
                  onClick={() => void handleResetFilters()}
                  size="lg"
                  className="h-10 w-10 min-h-10 min-w-10 rounded-md"
                />
              </BoxSearch>
            </ContainerInputs>
            <ContainerTrips>
              {filteredTrips?.length > 0 && (
                filteredTrips.map((trip, index) => (
                  <TripList key={index} trip={trip} setIsPrinting={setPrinting} onDeleteTrip={handleDeleteTrip} />
                ))
              )}
            </ContainerTrips>
          </>
        )}
      </Container>
    </div>
  );
}

export default Trips;
