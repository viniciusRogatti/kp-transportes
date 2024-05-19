import styled from 'styled-components';
import KpImage from '../../assets/images/KP-TRANSPORTES.png';
import KpMobileImage from '../../assets/images/KP-MOBILE.png';

export const Container = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  background: #001428;
`;

export const BoxLogin = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-top: 20px;
  width: 80%;
  max-width: 700px;
  height: 60%;
  max-height: 400px;
  border-radius: 12px;
  background-image: url(${KpImage});
  background-size: cover;
  box-shadow:  2px 2px 14px #000000d7,
  -4px -4px 20px #000000bd;


  @media only screen and (max-width: 768px) {
    background-image: url(${KpMobileImage});
  }
`;

export const ButtonLogin = styled.button`
  background: #001428;
  border-radius: 5px;
  width: 44%;
  max-width: 300px;
  height: 40px;
  border: none;
  font-weight: bold;
  text-transform: uppercase;
  color: #FFFFFF;
  border: solid 1px #ffff;
  cursor: pointer;

  @media only screen and (max-width: 768px) {
    width: 78%;
  }
`;

export const BoxInput = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  position: absolute;
  bottom: 40px;

  input {
    background-color: transparent;
    border: solid 1px #001428;
  }
`;

export const InputLogin = styled.input`
  width: 40%;
  max-width: 300px;
  height: 40px;
  border-radius: 5px;
  margin-bottom: 10px;
  padding-left: 20px;
  color: #001428;
  background-color: rgba(255, 255, 255, 0.5);

  ::placeholder {
    color: #001428;
  }

  @media only screen and (max-width: 768px) {
    width: 70%;
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

  @media only screen and (max-width: 768px) {
    width: 78%;
  }
`;
