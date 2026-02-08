import styled from "styled-components";


export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  min-height: 100dvh;
  background: transparent;
  position: relative;
  padding: calc(var(--header-height) + var(--space-5)) var(--space-5) var(--space-8);
  color: var(--color-text);

  table {
    color: var(--color-text);
    width: 100%;
    max-width: 1200px;
    border-collapse: collapse;
    font-size: clamp(0.78rem, 1.2vw, 0.95rem);
  }

  th {
    padding: var(--space-3);
    color: var(--color-accent);
    text-align: left;
    font-weight: 600;
  }

  td {
    padding: var(--space-3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  td:nth-child(2) {
    max-width: 420px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    padding: calc(var(--header-height) + var(--space-4)) var(--space-4) var(--space-6);

    table {
      display: block;
      overflow-x: auto;
      font-size: 0.78rem;
    }

    th,
    td {
      padding: var(--space-2);
    }

    td:nth-child(2) {
      max-width: 200px;
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
  }
`;

export const FilterBar = styled.div`
  display: grid;
  width: min(100%, 900px);
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-5);

  @media (max-width: 768px) {
    width: 100%;
    gap: var(--space-2);
  }
`;

export const FilterInput = styled.input`
  height: 2.5rem;
  width: 100%;
  border-radius: var(--radius-1);
  border: 1px solid rgba(39, 198, 179, 0.35);
  padding: 0.5rem 0.75rem;
  background: rgba(11, 27, 42, 0.85);
  color: var(--color-text);
  box-shadow: 0 0 0 1px rgba(39, 198, 179, 0.1);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

  &::placeholder {
    color: var(--color-muted);
  }

  &:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px rgba(39, 198, 179, 0.2);
    transform: translateY(-1px);
  }
`;
