import styled from "styled-components";

export const ContainerTrips = styled.div`
  margin-top: 40px;
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
`;

export const ContainerInputs = styled.div`
  display: flex;
  width: 200px;
  align-items: center;
  justify-content: center;
  flex-direction: column;

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
  height: 300px;
  border: solid 2px #2779a7;
  padding: 2px 12px;
  background-color: #ecd16f;
  border-radius: 12px;
  box-shadow:  4px 4px 20px #2779a7,
  -4px -4px 15px #000000;

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

  button {
    position: absolute;
    left: 0;
    bottom: 0;
    border: none;
    padding: 8px 4px;
    border-radius: 4px;
    width: 100%;
    cursor: pointer;
  }
`;

export const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
`;
export const LeftHeader = styled.div``;

export const RightHeader = styled.div`
  text-align: right;
`;

export const TripNotesContainer = styled.div`
  display: flex;
  max-height: 200px;
  overflow-y: auto;
`;


export const TripNotesList = styled.ul`
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 16px;
`;

export const TripNoteItem = styled.li`
  flex: 1 1 calc(33.3333% - 8px);
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  position: relative;

  p {
    font-size: 10px;
  }

  h4 {
    font-size: 14px;
  }
`;

