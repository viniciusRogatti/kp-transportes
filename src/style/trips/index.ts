import styled from "styled-components";

export const ContainerTrips = styled.div`
  margin-top: var(--space-5);
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  gap: var(--space-4);
  justify-content: center;
`;

export const ContainerInputs = styled.div`
  display: flex;
  width: 100%;
  max-width: 260px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: var(--color-text);

`
export const BoxSearch = styled.div`
  display: flex;
  position: relative;
  width: 100%;
  gap: var(--space-1);

  input {
    margin: 0;
    position: absolute;
    top: 0;
    left: 0;
    padding: 0.5rem 0.75rem;
    border: none;
    border-radius: var(--radius-2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(11, 27, 42, 0.6);
    color: var(--color-text);
  }

  & > button {
    position: absolute;
    top: 2.4rem;
    border-radius: var(--radius-1);
    right: 0;
    padding: 0.4rem 0.6rem;
    border: none;
    background: var(--color-accent);
    color: #04131e;
  }

  span {
    color: #04131e;
    border-color: black !important;
  }
`;

export const CardTrips = styled.div`
  display: flex;
  position: relative;
  justify-content: start;
  align-items: center;
  flex-direction: column;
  width: min(320px, 100%);
  min-height: 320px;
  border: 1px solid rgba(12, 39, 60, 0.2);
  padding: var(--space-3) var(--space-4);
  background-color: var(--color-card);
  border-radius: var(--radius-3);
  box-shadow: var(--shadow-1);
  color: #0b1b2a;

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
  padding: var(--space-4);
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
  width: 100%;
  height: 70px;
  padding: var(--space-2);
  border: 1px solid rgba(12, 39, 60, 0.2);
  border-radius: var(--radius-1);
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
    background: #1d3952;
    border: none;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-1);
    color: var(--color-text);
    width: 45%;
    cursor: pointer;
    margin: var(--space-2);
  }
`;
