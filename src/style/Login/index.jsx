import styled from 'styled-components';
import KpImage from '../../assets/images/KP.png';
import KpMobileImage from '../../assets/images/KP-MOBILE.png';

export const Container = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
`;

export const BoxLogin = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
  background: #ECD06F;
  width: 70%;
  max-width: 600px;
  height: 50%;
  max-height: 400px;
  border-radius: 12px;
  background-image: url(${KpImage});
  background-size: cover;
  box-shadow:  2px 2px 14px #000000d7,
  -4px -4px 20px #000000bd;


  @media only screen and (max-width: 768px) {
    background-image: url(${KpMobileImage}); /* Altera a imagem de fundo para dispositivos móveis */
  }
`;

export const ButtonLogin = styled.button`
  background: #2779a7;
  border-radius: 5px;
  width: 44%;
  max-width: 300px;
  height: 40px;
  border: none;
  font-weight: bold;
  text-transform: uppercase;
  color: #FFFFFF;

  :disabled {
    opacity: 0.3;
  }
`;

export const InputLogin = styled.input`
  width: 40%;
  max-width: 300px;
  height: 40px;
  border: 0.5px solid #2779a7;
  border-radius: 5px;
  margin-bottom: 10px;
  padding-left: 20px;
  color: #2779a7;

  ::placeholder {
    color: #2779a7;
  }
`;

export const ViewPassword = styled.input`
  display: none;
`;

export const BoxPassword = styled.div`
  position: relative;
  align-items: center;
  justify-content: center;
  width: 44%;
  max-width: 300px;
  display: flex;

  svg {
    position: absolute;
    right: 12px;
    bottom: 22px;
  }

  input {
    width: 100%;
  }
`;
