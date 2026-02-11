import styled from "styled-components";
import { keyframes } from "styled-components";

const notesPulse = keyframes`
  0% {
    opacity: 0.72;
    transform: translateY(3px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const ContainerTodayInvoices = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100dvh;
  background-color: transparent;
  position: relative;
`;

export const FilterBar = styled.div`
  display: grid;
  align-items: end;
  justify-content: center;
  width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
  color: var(--color-text);
  margin-bottom: var(--space-6);

  input {
    height: 2.5rem;
    width: 100%;
    border-radius: var(--radius-1);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.5rem 0.75rem;
    background: rgba(11, 27, 42, 0.6);
    color: var(--color-text);
  }

  input::placeholder {
    color: var(--color-muted);
  }

  select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-1);
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(11, 27, 42, 0.6);
    color: var(--color-text);
  }

  div {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  button {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border-radius: var(--radius-2);
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
    color: #04131e;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  button:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);

    div {
      grid-column: 1 / -1;
    }

    .route-filter {
      display: none;
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
  color: var(--color-text);
  font-size: clamp(1rem, 1.8vw, 1.4rem);
  font-weight: 600;
  margin: var(--space-3);
  animation: ${notesPulse} 0.45s ease-out;
`;
