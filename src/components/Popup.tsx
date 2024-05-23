import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../data';
import { Overlay, PopupContainer, PopupContent, InputBox, ButtonBox } from '../style/Popup';

interface IPopup {
  title: string;
  closePopup: () => void;
  onAdd: (data: any) => void;
};

function Popup({ title, closePopup, onAdd }: IPopup) {
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
    if (value === '') {
      return alert('Digite o nome do motorista ou o modelo do Veículo');
    }
    if (title === 'Adicionar Veículo' && plate === '') {
      return alert('Digite a placa do Veículo');
    }

    try {
      let data = {};
      if (title === 'Adicionar Veículo') {
        data = {
          model: value,
          license_plate: plate,
        }
      } else data = { name: value };

      const route = title === 'Adicionar Motorista' ? 'drivers' : 'cars';
      const response = await axios.post(`${API_URL}/${route}/create`, data);
      
      alert(`${title === 'Adicionar Motorista' ? 'Motorista' : 'Carro'} Adicionado com sucesso!`);
      
      setPlate('');
      setValue('');
      onAdd(response.data); // Callback to return the created data
      closePopup();
      
    } catch (error) {
      console.log(`Erro ao ${title}`, error);      
    }
  }

  return (
    <>
      <Overlay />
      <PopupContainer>
        <PopupContent>
          <h2>{title}</h2>
          <InputBox>
            {title === 'Adicionar Motorista' ? 'Digite o nome do motorista' : 'Digite o modelo do Veículo'}
            <input type="text" value={ value } onChange={onInputChange} />
          </InputBox>
          { title === 'Adicionar Veículo' && (
              <InputBox>
                Digite a placa do Veículo
                <input type="text" value={ plate } onChange={changeLicensePlate} />
              </InputBox>
            )}
          <ButtonBox>
            <button onClick={handleSubmit}>Adicionar</button>
            <button className="close" onClick={closePopup}>Fechar</button>
          </ButtonBox>
        </PopupContent>
      </PopupContainer>
    </>
  )
}

export default Popup;
