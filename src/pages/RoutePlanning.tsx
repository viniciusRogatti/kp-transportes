import React, { useEffect, useState, ChangeEvent } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { BoxDriverVehicle, BoxSelectDanfe, ContainerForm, ContainerRoutePlanning, TitleRoutePlanning, TripsContainer } from '../style/RoutePlanning';
import { ICar, IDanfeTrip, IDriver } from '../types/types';
import { API_URL } from '../data';
import { Container } from '../style/incoives';


function RoutePlanning() {
  const [drivers, setDrivers] = useState<IDriver[]>([]);
  const [cars, setCars] = useState<ICar[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('null');
  const [selectedCar, setSelectedCar] = useState<string>('null');
  const [barcode, setBarcode] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [addedNotes, setAddedNotes] = useState<IDanfeTrip[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const carsResponse = await axios.get(`${API_URL}/cars`);
        const driversResponse = await axios.get(`${API_URL}/drivers`);
        setCars(carsResponse.data);
        setDrivers(driversResponse.data);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      }
    };
    fetchData();
  }, []);

  const handleDriverChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedDriver(e.target.value);
  };

  const handleCarChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedCar(e.target.value);
  };

  const handleBarcodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    setBarcode(e.target.value);
  };

  const handleInvoiceNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInvoiceNumber(e.target.value);
  };

  const handleAddNote = async () => {
    if (barcode) {
      try {
        const response = await axios.get(`${URL}/danfes/barcode/${barcode}`);
        const danfeData = response.data;
        const newNote: IDanfeTrip = {
          customerName: danfeData.Customer.name_or_legal_entity,
          phone: danfeData.Customer.phone,
          nf: danfeData.invoice_number,
          city: danfeData.Customer.city,
          cnpj: danfeData.Customer.cnpj_or_cpf,
          order: addedNotes.length + 1,
          grossWeight: danfeData.gross_weight
        };

        addNoteToList(newNote);
      } catch (error) {
        console.log('Não foi possível buscar essa nota, verifique o código de barras digitado');
      }
    } else if (invoiceNumber) {
      try {  
        
        const response = await axios.get(`${API_URL}/danfes/nf/${invoiceNumber}`);
        const danfeData = response.data;
        
    
        const newNote: IDanfeTrip = {
          customerName: danfeData.Customer.name_or_legal_entity,
          phone: danfeData.Customer.phone,
          nf: danfeData.invoice_number,
          city: danfeData.Customer.city,
          cnpj: danfeData.Customer.cnpj_or_cpf,
          order: addedNotes.length + 1,
          grossWeight: danfeData.gross_weight
        };

        addNoteToList(newNote);
      } catch (error) {
        console.log('Não foi possível buscar essa nota, verifique a NF digitada');
      }
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
        console.log('Selecione um motorista, um veículo e adicione pelo menos uma nota antes de enviar a viagem.');
        return;
      }
  
      const tripData = {
        driver_id: selectedDriver,
        car_id: selectedCar,
        date: new Date().toISOString().split('T')[0],
        gross_weight: total,
        tripNotes: sortedNotes.map((note) => ({
          invoice_number: note.nf,
          status: 'pending',
          order: note.order,
        })),
      };
      
      // Envia os dados da viagem para o backend
      const response = await axios.post(`${URL}/trips/create`, tripData);
  
      console.log('Viagem enviada com sucesso:', response.data);
  
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

          
        <button onClick={handleAddNote}>Adicionar Nota</button>
        <button onClick={sendTripsToBackend}>Enviar Viagem</button>
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
      </Container>

    </ContainerRoutePlanning>
  );
}

export default RoutePlanning;
