import { useEffect, useState, ChangeEvent, KeyboardEvent } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { BoxButton, BoxDriverVehicle, BoxInfo, BoxSelectDanfe, CardsTripsNotes, ContainerForm, ContainerRoutePlanning, TitleRoutePlanning, TripsContainer } from '../style/RoutePlanning';
import { ICar, IDriver, ITrip, ITripNote } from '../types/types';
import { API_URL } from '../data';
import { Container } from '../style/invoices';
import { formatToTimeZone } from 'date-fns-timezone';
import { useNavigate } from 'react-router';
import verifyToken from '../utils/verifyToken';
import Popup from '../components/Popup';
import { format } from 'date-fns';
import { TruckLoader } from '../style/Loaders';
import { FaArrowRightLong, FaArrowLeftLong } from "react-icons/fa6";
import { AnimatePresence } from "framer-motion";

function RoutePlanning() {
  const [drivers, setDrivers] = useState<IDriver[]>([]);
  const [cars, setCars] = useState<ICar[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('null');
  const [selectedCar, setSelectedCar] = useState<string>('null');
  const [barcode, setBarcode] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [addedNotes, setAddedNotes] = useState<ITripNote[]>([]);
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [titlePopup, setTitlePopup] = useState<string>('');
  const [todayTrips, setTodayTrips] = useState<ITrip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [countWeight, setCountWeight] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [tripToUpdate, setTripToUpdate] = useState<ITrip | null>(null);

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
    };
    fetchToken();
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnterPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddNote();
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const today = format(new Date(), 'dd-MM-yyyy');
      const carsResponse = await axios.get(`${API_URL}/cars`);
      const driversResponse = await axios.get(`${API_URL}/drivers`);
      const response = await axios.get(`${API_URL}/trips/search/date/${today}`);
      setTodayTrips(response.data);
      setCars(carsResponse.data);
      setDrivers(driversResponse.data);
      setIsLoading(false);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    }
  };

  const handleChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.id === 'driver' ? 'Driver' : 'Car';
    if (key === 'Driver') {
      setSelectedDriver(e.target.value);
    } else setSelectedCar(e.target.value);
    
    setAddedNotes([]);
    if (todayTrips.length > 0) {
      setCountWeight(0);
      setIsLoading(true);
      const tripsByDriverOrCar = todayTrips.filter((trip: ITrip) => trip[key].id === +e.target.value && 
        !trip.TripNotes.every(note => ['returned', 'cancelled', 'delivered'].includes(note.status)));
      
      if (tripsByDriverOrCar.length > 0) {
        const trip = tripsByDriverOrCar[0];
        setTripToUpdate(trip);
        setIsUpdating(true);
        setCountWeight(+trip.gross_weight);   
        const tripNotes = trip.TripNotes.filter(note => !['returned', 'cancelled', 'delivered'].includes(note.status));
        
        setAddedNotes(tripNotes);        

        if (key === 'Driver') {
          setSelectedCar(trip.Car.id.toString());
        } else {
          setSelectedDriver(trip.Driver.id.toString());  
        }
      } else {
        setIsUpdating(false);
        setTripToUpdate(null);
      }
    }
    setIsLoading(false);
  };

  const handleBarcodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    setBarcode(e.target.value);
  };

  const handleInvoiceNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInvoiceNumber(e.target.value);
  };

  const handleAddNote = async () => {
    if (selectedDriver === 'null' || selectedCar === 'null') {
      alert('Selecione um motorista e um veículo antes de adicionar uma nota!');
      return;
    }
    
    try {
      setIsLoading(true);
      const route = barcode ? `/danfes/barcode/${barcode}` : `/danfes/nf/${invoiceNumber}`;
      const response = await axios.get(`${API_URL}${route}`);
      const danfeData = response.data;
      setIsLoading(false);
      
      if (danfeData.status !== 'pending' && danfeData.status !== 'redelivery') {
        alert('Essa nota não pode ser roteirizada, verifique o status dela');
        setBarcode('');
        setInvoiceNumber('');
        return;
      } 

      if (addedNotes.some((note) => danfeData.invoice_number === note.invoice_number)) {
        alert('Esta nota já foi adicionada à viagem.');
        setBarcode('');
        setInvoiceNumber('');
        return;
      }

      const newNote: ITripNote = {
        customer_name: danfeData.Customer.name_or_legal_entity,
        invoice_number: danfeData.invoice_number,
        city: danfeData.Customer.city,
        order: addedNotes.length + 1,
        gross_weight: danfeData.gross_weight,
        status: "pending",
      };

      addNoteToList(newNote);
      setCountWeight((prev) => prev += +danfeData.gross_weight);
    } catch (error) {
      alert('Não foi possível buscar essa nota');
    }
  
    setBarcode('');
    setInvoiceNumber('');
  };

  const addNoteToList = (note: ITripNote) => {
    setAddedNotes((prevNotes) => [...prevNotes, note]);
  };

  const removeNoteFromList = async (nf: string, noteId: any) => {
    
    if (tripToUpdate) {
      setIsLoading(true);
      
      try {
        const response = await axios.put(`${API_URL}/trips/remove-note/${tripToUpdate?.id}`, { noteId });
        const dataUpdate = {
          danfes: [{
            invoice_number: nf,
            status: 'pending',
          }]
        };
        await axios.put(`${API_URL}/danfes/update-status`, dataUpdate);
        if (response.data) setAddedNotes(addedNotes.filter(note => note.invoice_number !== nf));
      } catch (error) {
        console.log(error);
      }
      setIsLoading(false);
    }
  };

  const sendTripsToBackend = async () => {
    const total = addedNotes.reduce((accumulator, note) => accumulator + +note.gross_weight, 0);
    
    try {
      if (selectedDriver === 'null' || selectedCar === 'null' || sortedNotes.length === 0) {
        alert('Selecione um motorista, um veículo e adicione pelo menos uma nota antes de enviar a viagem.');
        return;
      }

      const format = 'DD-MM-YYYY';
      const today = formatToTimeZone(new Date(), format, { timeZone: "America/Sao_Paulo" });

      const dataUpdate = {
        danfes: addedNotes.map((note) => ({
          invoice_number: note.invoice_number,
          status: 'assigned',
        })),
      };
      setIsLoading(true);
      await axios.put(`${API_URL}/danfes/update-status`, dataUpdate);

      const tripData = {
        driver_id: selectedDriver,
        car_id: selectedCar,
        date: today,
        gross_weight: total,
        tripNotes: sortedNotes.map(({invoice_number, city, customer_name, order, gross_weight}) => ({
          invoice_number,
          city,
          customer_name,
          status: 'assigned',
          order,
          gross_weight,
        })),
      };

      
      await axios.post(`${API_URL}/trips/create`, tripData);
      
      if (isUpdating && tripToUpdate) {
        await axios.delete(`${API_URL}/trips/delete/${tripToUpdate.id}`);
        const response = await axios.get(`${API_URL}/trips/search/date/${today}`);
        setTodayTrips(response.data);
      }
      
      setIsLoading(false);

      alert(`${isUpdating && tripToUpdate ? 'Viagem Atualizada com sucesso!' : 'Viagem Criada com sucesso!'}`);

      setSelectedDriver('null');
      setSelectedCar('null');
      setAddedNotes([]);
      setIsUpdating(false);
      setTripToUpdate(null);
    } catch (error) {
      console.error('Erro ao enviar a viagem:', error);
    }
  };

  const moveNoteUp = (order: number) => {
    const updatedNotes = [...addedNotes];

    const precedingNoteIndex = updatedNotes.findIndex((note) => note.order === order - 1);
    const selectedNoteIndex = updatedNotes.findIndex((note) => note.order === order);

    if (precedingNoteIndex !== -1 && selectedNoteIndex !== -1) {
      [updatedNotes[precedingNoteIndex].order, updatedNotes[selectedNoteIndex].order] = [
        updatedNotes[selectedNoteIndex].order,
        updatedNotes[precedingNoteIndex].order,
      ];

      setAddedNotes(updatedNotes);
    }
  };

  const moveNoteDown = (order: number) => {
    const updatedNotes = [...addedNotes];

    const followingNoteIndex = updatedNotes.findIndex((note) => note.order === order + 1);
    const selectedNoteIndex = updatedNotes.findIndex((note) => note.order === order);

    if (followingNoteIndex !== -1 && selectedNoteIndex !== -1) {
      [updatedNotes[followingNoteIndex].order, updatedNotes[selectedNoteIndex].order] = [
        updatedNotes[selectedNoteIndex].order,
        updatedNotes[followingNoteIndex].order,
      ];

      setAddedNotes(updatedNotes);
    }
  };

  const addDriverOrCar = (e: React.MouseEvent<HTMLButtonElement>) => {
    setShowPopup(true);
    setTitlePopup(e.currentTarget.innerText);
  };

  const handleAddNewDriverOrCar = (data: any) => {
    if (titlePopup === 'Adicionar Motorista') {
      setDrivers([...drivers, data]);
    } else {
      setCars([...cars, data]);
    }
  };

  const sortedNotes = addedNotes.slice().sort((a, b) => a.order - b.order);

  return (
    <ContainerRoutePlanning>
      <Header />
      <Container>
        <TitleRoutePlanning>Roteirização</TitleRoutePlanning>
        { isLoading ? (
          <TruckLoader />
        ): (
          <>
            <ContainerForm>
              <BoxDriverVehicle>
                <label>Motorista:</label>
                <select id="driver" onChange={handleChange} value={selectedDriver || ''}>
                  <option value="null">Selecione um motorista</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
                <label>Veículo:</label>
                <select id="car" onChange={handleChange} value={selectedCar || ''}>
                  <option value={'null'}>Selecione um veículo</option>
                  {cars.map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.model} - {car.license_plate}
                    </option>
                  ))}
                </select>
              </BoxDriverVehicle>
              <div>
                <label>Selecione uma nota:</label>
                <BoxSelectDanfe>
                  <input 
                    type="text" 
                    onKeyDown={handleEnterPress} 
                    placeholder="Digite o código de barras" 
                    value={barcode} 
                    onChange={handleBarcodeChange} 
                  />
                  <input 
                    type="text" 
                    onKeyDown={handleEnterPress} 
                    placeholder="Digite a NF" 
                    value={invoiceNumber} 
                    onChange={handleInvoiceNumberChange} 
                  />
                </BoxSelectDanfe>
              </div>

              <BoxButton>
                <button className="btn-submit" onClick={sendTripsToBackend}>{isUpdating ? 'Atualizar Viagem' : 'Enviar Viagem'}</button>
                <button className="btn-add-driver" onClick={addDriverOrCar}>Adicionar Motorista</button>
                <button className="btn-add-danfe" onClick={handleAddNote}>Adicionar Nota</button>
                <button className="btn-add-car" onClick={addDriverOrCar}>Adicionar Veículo</button>
              </BoxButton>
            </ContainerForm>

            <BoxInfo>
              <p>{`Peso total: `}<span>{countWeight.toFixed(2)}</span></p>
              <p><span>{sortedNotes.length}</span>{` nota(s) adicionada(s)`}</p>
            </BoxInfo>
            <TripsContainer layout>
              <AnimatePresence>
                {sortedNotes.map((note) => (
                  <CardsTripsNotes
                    key={note.invoice_number}
                    layout
                    initial={{ opacity: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: [1, 0.5] }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 1 }}
                  >
                    <h5>{note.order}</h5>
                    <h2>{note.invoice_number}</h2>
                    <h4>{note.customer_name}</h4>
                    <h3>{note.city}</h3>
                    <p>{`${note.gross_weight} Kg`}</p>
                    <button 
                      onClick={() => removeNoteFromList(note.invoice_number, note.id)}
                      className="btn-remove"
                    >
                      Remover
                    </button>
                    <button 
                      onClick={() => moveNoteUp(note.order)} 
                      disabled={note.order === 1}
                      className="btn-left"
                    >
                      <FaArrowLeftLong />
                    </button>
                    <button
                      onClick={() => moveNoteDown(note.order)}
                      disabled={note.order === addedNotes.length}
                      className="btn-right"
                    >
                      <FaArrowRightLong />
                    </button>
                  </CardsTripsNotes>
                ))}
              </AnimatePresence>
            </TripsContainer>
          </>
        )}

        {showPopup && (
          <Popup 
            title={titlePopup} 
            closePopup={() => setShowPopup(false)}
            onAdd={handleAddNewDriverOrCar}          
          />
        )}
      </Container>
    </ContainerRoutePlanning>
  );
}

export default RoutePlanning;
