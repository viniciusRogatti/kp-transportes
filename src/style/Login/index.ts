import styled from 'styled-components';
import KpImage from '../../assets/images/KP-TRANSPORTES.png';
import KpMobileImage from '../../assets/images/KP-MOBILE.png';

export const Container = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  width: 100%;
  background: transparent;
  padding: var(--space-6) var(--space-4);
`;

export const BoxLogin = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-top: var(--space-5);
  width: min(90%, 720px);
  max-width: 700px;
  min-height: 360px;
  max-height: 400px;
  border-radius: var(--radius-3);
  background-image: url(${KpImage});
  background-size: cover;
  background-position: center;
  box-shadow: var(--shadow-1);


  @media only screen and (max-width: 768px) {
    background-image: url(${KpMobileImage});
  }
`;

export const ButtonLogin = styled.button`
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
  border-radius: var(--radius-2);
  width: 44%;
  max-width: 300px;
  height: 40px;
  border: none;
  font-weight: bold;
  text-transform: uppercase;
  color: #04131e;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.25);
  }

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
  border-radius: var(--radius-2);
  margin-bottom: var(--space-2);
  padding-left: 20px;
  color: #0b1b2a;
  background-color: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(10, 26, 41, 0.2);

  ::placeholder {
    color: #0b1b2a;
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
