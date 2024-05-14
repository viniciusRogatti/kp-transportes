import { useEffect, useState, ChangeEvent } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { BoxButton, BoxDriverVehicle, BoxSelectDanfe, ContainerForm, ContainerRoutePlanning, TitleRoutePlanning, TripsContainer } from '../style/RoutePlanning';
import { ICar, IDanfe, IDanfeTrip, IDriver, ITrip } from '../types/types';
import { API_URL } from '../data';
import { Container } from '../style/incoives';
import  {  formatToTimeZone } from 'date-fns-timezone';
import { useNavigate } from 'react-router';
import verifyToken from '../utils/verifyToken';
import Popup from '../components/Popup';
import { format } from 'date-fns';



function RoutePlanning() {
  const [drivers, setDrivers] = useState<IDriver[]>([]);
  const [cars, setCars] = useState<ICar[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('null');
  const [selectedCar, setSelectedCar] = useState<string>('null');
  const [barcode, setBarcode] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [addedNotes, setAddedNotes] = useState<IDanfeTrip[]>([]);
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [titlePopup, setTitlePopup] = useState<string>('');
  const [todayTrips, setTodayTrips] = useState<ITrip[]>([]);

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
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dataToDanfeTrip = (data: any) => {
    const newNote: IDanfeTrip = {
      customerName: data.Customer.name_or_legal_entity,
      phone: data.Customer.phone,
      nf: data.invoice_number,
      city: data.Customer.city,
      cnpj: data.Customer.cnpj_or_cpf,
      order: addedNotes.length + 1,
      grossWeight: data.gross_weight
    };

    return newNote;
  };
  
  const fetchData = async () => {
    try {
      const today = format(new Date(), 'dd-MM-yyyy');
      const carsResponse = await axios.get(`${API_URL}/cars`);
      const driversResponse = await axios.get(`${API_URL}/drivers`);
      const response = await axios.get(`${API_URL}/trips/search/date/${today}`);
      setTodayTrips(response.data)
      setCars(carsResponse.data);
      setDrivers(driversResponse.data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    }
  };

  const handleDriverChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedDriver(e.target.value);
    setAddedNotes([]);
    if (todayTrips.length > 0) {
      const tripsByDriver = todayTrips.filter((trip: ITrip) => trip.Driver.id === +e.target.value);
      if (tripsByDriver.length > 0) {
        const tripNotes = tripsByDriver[0]?.TripNotes;
        let listTrips = [];
        for (let i = 0; i < tripNotes.length; i++) {
          const response = await axios.get(`${API_URL}/danfes/nf/${tripNotes[i].invoice_number}`);
          const data = response.data;
          listTrips.push(dataToDanfeTrip(data));        
        }
          setAddedNotes(listTrips);
          setSelectedCar(tripsByDriver[0].Car.id.toString());
        }  
    }
  };

  const handleCarChange =  async (e: ChangeEvent<HTMLSelectElement>) => {
    setAddedNotes([]);
    setSelectedCar(e.target.value);
    if (todayTrips.length > 0) {    

      const tripsByCar = todayTrips.filter((trip: ITrip) => trip.Car.id === +e.target.value);
      console.log(e.target.value, tripsByCar);
        
      if (tripsByCar.length > 0) {
        const tripNotes = todayTrips[0]?.TripNotes;
        let listTrips = [];
        for (let i = 0; i < tripNotes.length; i++) {
          const response = await axios.get(`${API_URL}/danfes/nf/${tripNotes[i].invoice_number}`);
          const data = response.data;
          listTrips.push(dataToDanfeTrip(data));          
        }
        setAddedNotes(listTrips);
        setSelectedDriver(tripsByCar[0].Driver.id.toString());        
      }
    }
  };

  const handleBarcodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    setBarcode(e.target.value);
  };

  const handleInvoiceNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInvoiceNumber(e.target.value);
  };

  const handleAddNote = async () => {
    try {
      const route = barcode ? `/danfes/barcode/${barcode}` : `/danfes/nf/${invoiceNumber}`;
      const response = await axios.get(`${API_URL}${route}`);
      const danfeData = response.data;     
      
      if (danfeData.status !== 'pending' && danfeData.status !== 'redelivery') {
        alert('Essa nota não pode ser roteirizada, verifique o status dela');
        setBarcode('');
        setInvoiceNumber('');
        return;
      } 

      if (addedNotes.some((note) => danfeData.invoice_number === note.nf)) {
        alert('Esta nota já foi adicionada à viagem.');
        setBarcode('');
        setInvoiceNumber('');
        return;
      }

      addNoteToList(dataToDanfeTrip(danfeData));
    } catch (error) {
      alert('Não foi possível buscar essa nota');
    }
  
    setBarcode('');
    setInvoiceNumber('');
  };

  const addNoteToList = (note: IDanfeTrip) => {
    setAddedNotes((prevNotes) => [...prevNotes, note]);
  };

  const removeNoteFromList = (nf: string) => {
    setAddedNotes((prevNotes) => prevNotes.filter((note) => note.nf !== nf));
  };

  const sendTripsToBackend = async () => {
    const total = addedNotes.reduce((accumulator, note) => accumulator + +note.grossWeight, 0);
      
    try {
      if (selectedDriver === 'null' || selectedCar === 'null' || sortedNotes.length === 0) {
        alert('Selecione um motorista, um veículo e adicione pelo menos uma nota antes de enviar a viagem.');
        return;
      }

      const format = 'DD-MM-YYYY'
      const today = formatToTimeZone(new Date(), format, { timeZone: "America/Sao_Paulo"});

      const dataUpdate = {
        danfes: addedNotes.map((note) => ({
          invoice_number: note.nf,
          status: 'assigned', // Define o novo status aqui
        })),
      };      

      await axios.put(`${API_URL}/danfes/update-status`, dataUpdate);
  
      const tripData = {
        driver_id: selectedDriver,
        car_id: selectedCar,
        date: today,
        gross_weight: total,
        tripNotes: sortedNotes.map((note) => ({
          invoice_number: note.nf,
          status: 'assigned',
          order: note.order,
        })),
      };
      
      // Envia os dados da viagem para o backend
      const response = await axios.post(`${API_URL}/trips/create`, tripData);
  
      alert('Viagem enviada com sucesso');
  
      // Limpa os campos após o envio bem-sucedido
      setSelectedDriver('null');
      setSelectedCar('null');
      setAddedNotes([]);
    } catch (error) {
      console.error('Erro ao enviar a viagem:', error);
    }
  };
  
  const moveNoteUp = (order: number) => {
    const updatedNotes = [...addedNotes]; // Cria uma cópia do array para garantir imutabilidade
  
    const precedingNoteIndex = updatedNotes.findIndex((note) => note.order === order - 1);
    const selectedNoteIndex = updatedNotes.findIndex((note) => note.order === order);
  
    if (precedingNoteIndex !== -1 && selectedNoteIndex !== -1) {
      // Trocando as ordens dos dois elementos
      [updatedNotes[precedingNoteIndex].order, updatedNotes[selectedNoteIndex].order] = [
        updatedNotes[selectedNoteIndex].order,
        updatedNotes[precedingNoteIndex].order,
      ];

      setAddedNotes(updatedNotes); // Atualiza o estado com o novo array
    }
  };
  
  const moveNoteDown = (order: number) => {
    const updatedNotes = [...addedNotes]; // Cria uma cópia do array para garantir imutabilidade
  
    const followingNoteIndex = updatedNotes.findIndex((note) => note.order === order + 1);
    const selectedNoteIndex = updatedNotes.findIndex((note) => note.order === order);
  
    if (followingNoteIndex !== -1 && selectedNoteIndex !== -1) {
      // Trocando as ordens dos dois elementos
      [updatedNotes[followingNoteIndex].order, updatedNotes[selectedNoteIndex].order] = [
        updatedNotes[selectedNoteIndex].order,
        updatedNotes[followingNoteIndex].order,
      ];
  
      setAddedNotes(updatedNotes); // Atualiza o estado com o novo array
    }
  };

  const addDriverOrCar = (e: React.MouseEvent<HTMLButtonElement>) => {
    setShowPopup(true);
    setTitlePopup(e.currentTarget.innerText);
  }

  const sortedNotes = addedNotes.slice().sort((a, b) => a.order - b.order);

  return (
    <ContainerRoutePlanning>
      <Header />
      <Container>
        <TitleRoutePlanning>Roteirização</TitleRoutePlanning>
        <ContainerForm>
          <BoxDriverVehicle>
            <label>Motorista:</label>
            <select onChange={handleDriverChange} value={selectedDriver || ''}>
              <option value="null">Selecione um motorista</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
            <label>Veículo:</label>
            <select onChange={handleCarChange} value={selectedCar || ''}>
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
              <input type="text" placeholder="Digite o código de barras" value={barcode} onChange={handleBarcodeChange} />
              <input type="text" placeholder="Digite a NF" value={invoiceNumber} onChange={handleInvoiceNumberChange} />
            </BoxSelectDanfe>
          </div>

        <BoxButton>
          <button onClick={handleAddNote}>Adicionar Nota</button>
          <button onClick={sendTripsToBackend}>Enviar Viagem</button>
          <button onClick={addDriverOrCar}>Adicionar Motorista</button>
          <button onClick={addDriverOrCar}>Adicionar Veículo</button>
        </BoxButton>

        </ContainerForm>

        <TripsContainer>
            {sortedNotes.map((note) => (
              <li key={note.nf}>
                <h2>{note.nf}</h2>
                <h4>{note.customerName} </h4>
                <h4>{note.city} </h4>
                <p>{note.grossWeight}</p>
                <button onClick={() => removeNoteFromList(note.nf)}>Remover</button>
                <button onClick={() => moveNoteUp(note.order)} disabled={note.order === 1}>
                  Mover para cima
                </button>
                <button
                  onClick={() => moveNoteDown(note.order)}
                  disabled={note.order === addedNotes.length}
                >
                  Mover para baixo
                </button>
              </li>
            ))}
        </TripsContainer>

        {showPopup && (
          <Popup title={titlePopup} closePopup={ () => setShowPopup(false)} />
        )}

      </Container>

    </ContainerRoutePlanning>
  );
}

export default RoutePlanning;