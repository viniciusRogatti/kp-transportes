import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../data';
import { Overlay, PopupContainer, PopupContent, InputBox, ButtonBox, PopupButton } from '../style/Popup';
import { ICar, IDriver } from '../types/types';

interface IPopup {
  title: string;
  closePopup: () => void;
  onAdd: (data: any) => void;
  existingDrivers: IDriver[];
  existingCars: ICar[];
};

const normalizeText = (value: string) => String(value || '').replace(/\s+/g, ' ').trim();

const normalizeDriverName = (name: string) => normalizeText(name).toLocaleLowerCase();

const normalizeLicensePlate = (plate: string) => String(plate || '').toLocaleUpperCase().replace(/[^A-Z0-9]/g, '');

function Popup({ title, closePopup, onAdd, existingDrivers, existingCars }: IPopup) {
  const [value, setValue] = useState<string>('');
  const [plate, setPlate] = useState<string>('');

  const capitalizeFirstLetter = (word: string) => {
    return word.charAt(0).toUpperCase() + word.substring(1).toLocaleLowerCase();
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(capitalizeFirstLetter(e.target.value));
  }

  const changeLicensePlate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlate(e.target.value.toLocaleUpperCase());
  }

  const handleSubmit = async () => {
    const normalizedValue = normalizeText(value);
    const normalizedPlate = normalizeLicensePlate(plate);

    if (!normalizedValue) {
      return alert('Digite o nome do motorista ou o modelo do Veículo');
    }
    if (title === 'Adicionar Veículo' && !normalizedPlate) {
      return alert('Digite a placa do Veículo');
    }

    if (title === 'Adicionar Motorista') {
      const hasDuplicateDriver = existingDrivers.some(
        (driver) => normalizeDriverName(driver.name) === normalizeDriverName(normalizedValue),
      );

      if (hasDuplicateDriver) {
        return alert('Ja existe um motorista com esse nome.');
      }
    }

    if (title === 'Adicionar Veículo') {
      const hasDuplicateCar = existingCars.some(
        (car) => normalizeLicensePlate(car.license_plate) === normalizedPlate,
      );

      if (hasDuplicateCar) {
        return alert('Ja existe um veiculo com essa placa.');
      }
    }

    try {
      let data = {};
      if (title === 'Adicionar Veículo') {
        data = {
          model: normalizedValue,
          license_plate: normalizedPlate,
        }
      } else data = { name: normalizedValue };

      const route = title === 'Adicionar Motorista' ? 'drivers' : 'cars';
      const response = await axios.post(`${API_URL}/${route}/create`, data);
      
      alert(`${title === 'Adicionar Motorista' ? 'Motorista' : 'Carro'} Adicionado com sucesso!`);
      
      setPlate('');
      setValue('');
      onAdd(response.data); // Callback to return the created data
      closePopup();
      
    } catch (error: any) {
      console.error(`Erro ao ${title}`, error);
      const apiMessage = error?.response?.data?.message;
      alert(apiMessage || `Erro ao ${title.toLocaleLowerCase()}.`);
    }
  }

  return (
    <>
      <Overlay />
      <PopupContainer>
        <PopupContent>
          <h2>{title}</h2>
          <InputBox>
            {title === 'Adicionar Motorista' ? 'Nome do motorista' : 'Modelo do veículo'}
            <input
              type="text"
              value={value}
              onChange={onInputChange}
              placeholder={title === 'Adicionar Motorista' ? 'Ex.: João Silva' : 'Ex.: Iveco Tector'}
            />
          </InputBox>
          { title === 'Adicionar Veículo' && (
              <InputBox>
                Placa do veículo
                <input type="text" value={plate} onChange={changeLicensePlate} placeholder="Ex.: ABC1D23" />
              </InputBox>
            )}
          <ButtonBox>
            <PopupButton type="button" onClick={handleSubmit}>Adicionar</PopupButton>
            <PopupButton type="button" $tone="danger" onClick={closePopup}>Fechar</PopupButton>
          </ButtonBox>
        </PopupContent>
      </PopupContainer>
    </>
  )
}

export default Popup;
