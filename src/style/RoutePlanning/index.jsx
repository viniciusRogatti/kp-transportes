import styled from "styled-components";

export const ContainerRoutePlanning = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100vw;
  height: 100vh;
`;

export const ContainerForm = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  gap: 20px;
  
  button {
    width: 150px;
    padding: 8px 4px;
  }
`;

export const BoxButton = styled.div`
  display: flex;
  flex-wrap: wrap;
  width: 50%;
  gap: 8px;
  margin-top: 20px;

  button {
    width: 40%;
    border-radius: 4px;
    border: none;
    cursor: pointer;
  }
`;

export const TitleRoutePlanning = styled.h1`
  text-align: center;
  margin-top: 5px;
`;

export const TripsContainer = styled.ul`
  display: flex;
  align-items: center;
  flex-direction: column;
  margin-top: 24px;
  gap: 12px;
  width: 100vw;

  li {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 80%;
    height: 140px;
  }
`;

export const BoxDriverVehicle = styled.div`
  display: flex;
  flex-direction: column;
  align-items: start;
  justify-content: center;

  select {
    width: 11rem;
  }
`;

export const BoxSelectDanfe = styled.div`
  display: flex;
  flex-direction: column;
  align-items: start;
  justify-content: center;
  gap: 14px;

  input {
    width: 10rem;
    padding: 2px 4px;
  }
`;