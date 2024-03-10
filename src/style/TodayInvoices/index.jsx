import styled from "styled-components";

export const ContainerTodayInvoices = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #2779a7;
  position: relative;
`;

export const FilterBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 2.5rem;
  gap: 0.75rem;
  input {
    height: 0.875rem;
    width: 10rem;
    border-radius: 4px;
    border: solid 1px black;
    padding: 6px 8px;
  }
`;

export const ContainerDanfes = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  gap: 12px;
  width: 100%;
  height: 100%;
`;

export const NotesFound = styled.span`
  color: #ECD06F;
  font-size: 22px;
  font-weight: 500;
  margin: 0.625rem;
`;