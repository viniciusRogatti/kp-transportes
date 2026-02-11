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

export const SearchBar = styled.div`
  display: flex;
  align-items: end;
  flex-wrap: nowrap;
  width: min(100%, 1100px);
  gap: var(--space-3);
  margin-bottom: var(--space-5);

  input,
  .react-datepicker-wrapper input {
    height: 2.5rem;
    width: 100%;
    border-radius: var(--radius-1);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.5rem 0.75rem;
    background: rgba(11, 27, 42, 0.6);
    color: var(--color-text);
  }

  .date-picker-input {
    padding-right: 2.2rem !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239eb7ca' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 15px;
  }

  input::placeholder,
  .react-datepicker-wrapper input::placeholder {
    color: var(--color-muted);
  }

  .react-datepicker-wrapper {
    position: relative;
  }

  .react-datepicker-popper {
    z-index: 2000;
    position: absolute !important;
  }

  .react-datepicker {
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-2);
  }

  @media (max-width: 768px) {
    width: 100%;
    flex-direction: column;
    gap: var(--space-2);

    input,
    .react-datepicker-wrapper input {
      height: 2.25rem;
      padding: 0.4rem 0.6rem;
      font-size: 0.88rem;
    }
  }
`;

export const SearchButton = styled.button`
  height: 2.5rem;
  border-radius: var(--radius-2);
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
  color: #04131e;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 768px) {
    height: 2.25rem;
    font-size: 0.86rem;
    padding: 0 0.6rem;
  }
`;

export const SearchRow = styled.div`
  display: grid;
  grid-template-columns: minmax(150px, 180px) 130px;
  gap: var(--space-2);
  width: auto;
  align-items: stretch;

  @media (max-width: 768px) {
    width: 100%;
    grid-template-columns: minmax(0, 1fr) 108px;
  }
`;

export const DateRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 130px;
  gap: var(--space-2);
  width: auto;
  align-items: stretch;

  @media (max-width: 768px) {
    width: 100%;
    grid-template-columns: minmax(0, 1fr) 108px;
    align-items: stretch;
  }
`;

export const DateGroup = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(150px, 170px));
  gap: var(--space-2);
  width: auto;

  @media (max-width: 768px) {
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
`;

export const DateAction = styled.div`
  display: flex;
  align-items: stretch;
  width: auto;

  ${SearchButton} {
    width: min(130px, 100%);
    height: 100%;
  }

  @media (max-width: 768px) {
    width: 100%;
    min-width: 108px;

    ${SearchButton} {
      width: 100%;
    }
  }
`;
