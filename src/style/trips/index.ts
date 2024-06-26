import styled from "styled-components";

export const ContainerTrips = styled.div`
  margin-top: 40px;
  display: flex;
  width: 90%;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: start;
`;

export const ContainerInputs = styled.div`
  display: flex;
  width: 200px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: #fefefe;

`
export const BoxSearch = styled.div`
  display: flex;
  position: relative;
  width: 180px;
  gap: 2px;

  input {
    margin: 0;
    position: absolute;
    top: 0;
    left: 0;
    padding: 0.25rem;
    border: none;
    border-radius: 2px;
    border-bottom-right-radius: 18px;
  }

  & > button {
    position: absolute;
    top: 0.900rem;
    border-radius: 2px;
    right: 0;
    padding: 0.25rem;
    border: none;
    border-bottom-right-radius: 18px;
    background: #ECF3FD;
    color: black;
  }

  span {
    color: black;
    border-color: black !important;
  }
`;

export const CardTrips = styled.div`
  display: flex;
  position: relative;
  justify-content: start;
  align-items: center;
  flex-direction: column;
  width: 250px;
  height: 320px;
  border: solid 2px #000;
  padding: 2px 12px;
  background-color: #FEFEFE;
  border-radius: 12px;
  box-shadow:  4px 4px 20px #000000,
  -4px -4px 15px #000000;
  color: #000;

  p {
    font-size: 12px;
    position: relative;
  }

  h4 {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;   
    max-width: 300px;
  }
`;

export const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  width: 100%;
  padding: 16px;
`;
export const LeftHeader = styled.div`
  top: 6px;
  left: 20px;
  position: absolute;
  
  p {
    font-weight: bold;
    font-size: 14px;
  }
`;

export const RightHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: end;
  position: absolute;
  top: 6px;
  right: 20px;

  p {
    font-size: 12px;
  }
`;

export const TripNotesContainer = styled.div`
  position: absolute;
  top: 60px;
  left: 16px;
  display: flex;
  width: 87%;
  max-height: 200px;
  overflow-y: auto;
`;


export const TripNotesList = styled.ul`
  width: 100%;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  gap: 8px;
`;

export const TripNoteItem = styled.li`
  position: relative;
  width: 38%;
  height: 70px;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  position: relative;

  p {
    position: absolute;
    top: 35%;
    font-size: 10px;
  }

  h5{
    position: absolute;
    font-size: 16px;
    bottom: 4px;
    right: 8px;
  }

  h4 {
    position: absolute;
    font-size: 16px;
    top: 2px;
  }
`;


export const BoxButton = styled.div`
  display: flex;  
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  justify-content: space-between;

  button {
    background: #798EA7;
    border: none;
    padding: 8px 4px;
    border-radius: 4px;
    color: #FEFEFE;
    width: 45%;
    cursor: pointer;
    margin: 8px;
  }
`;
