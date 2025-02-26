import styled from "styled-components";

export const ContainerTodayInvoices = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: #001428;
  position: relative;
`;

export const FilterBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: row;
  flex-wrap: wrap;
  width: 100%;
  height: 2.5rem;
  gap: 0.75rem;
  color: #ECF3FD;
  margin-bottom: 30px;

  input {
    height: 0.875rem;
    width: 10rem;
    border-radius: 4px;
    border: solid 1px black;
    padding: 6px 8px;
  }

  select {
    margin: 0.5rem;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    margin-bottom: 30px;
    gap: 0;
    flex-wrap: nowrap;

    input {
    height: 0.475rem;
    width: 10rem;
    border-radius: 4px;
    border: solid 1px black;
    padding: 6px 8px;
  }
  }
`;

export const ContainerDanfes = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
`;

export const NotesFound = styled.span`
  color: #ECF3FD;
  font-size: 22px;
  font-weight: 500;
  margin: 0.625rem;
`;