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
  background: #2E2E3E;
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
  background: #2E2E3E;
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
    border: solid 1px #2E2E3E;
  }
`;

export const InputLogin = styled.input`
  width: 40%;
  max-width: 300px;
  height: 40px;
  border-radius: 5px;
  margin-bottom: 10px;
  padding-left: 20px;
  color: #2E2E3E;
  background-color: transparent;

  ::placeholder {
    color: #2E2E3E;
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
