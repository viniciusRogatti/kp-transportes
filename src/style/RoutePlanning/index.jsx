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
  gap: 2px;
  
  button {
    width: 150px;
    padding: 8px 4px;
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

  li {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 80%;
    height: 140px;
  }
`;