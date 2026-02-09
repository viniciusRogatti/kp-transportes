import styled from 'styled-components';

export const PageContainer = styled.div`
  width: min(1200px, 100%);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`;

export const Tabs = styled.div`
  display: flex;
  gap: var(--space-2);
  width: min(500px, 100%);

  button {
    flex: 1;
    height: 2.5rem;
    border-radius: var(--radius-2);
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(11, 27, 42, 0.75);
    color: var(--color-text);
    cursor: pointer;
    font-weight: 600;
  }

  button.active {
    background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
    color: #04131e;
    border-color: transparent;
  }
`;

export const TabsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  flex-wrap: wrap;
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-3);

  input,
  select,
  textarea {
    width: 100%;
    border-radius: var(--radius-1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.6rem 0.75rem;
    background: rgba(11, 27, 42, 0.6);
    color: var(--color-text);
  }

  textarea {
    min-height: 110px;
    resize: vertical;
  }
`;

export const Card = styled.section`
  background: rgba(8, 21, 33, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-3);
  padding: var(--space-4);
  box-shadow: var(--shadow-2);

  h2 {
    margin-bottom: var(--space-3);
    font-size: 1.05rem;
  }
`;

export const BoxDescription = styled.div`
  display: flex;
  gap: var(--space-2);
`;

export const Actions = styled.div`
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;

  button {
    border: none;
    border-radius: var(--radius-2);
    padding: 0.65rem 1rem;
    cursor: pointer;
    font-weight: 600;
  }

  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .primary {
    background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
    color: #04131e;
  }

  .secondary {
    background: rgba(255, 255, 255, 0.12);
    color: var(--color-text);
  }

  .danger {
    background: #f05e5e;
    color: #fff;
  }
`;

export const ReturnSearchRow = styled.div`
  display: flex;
  gap: var(--space-3);
  align-items: center;

  input[type='number'] {
    width: max-content;
    border-radius: var(--radius-1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.6rem 0.75rem;
    background: rgba(11, 27, 42, 0.6);
    color: var(--color-text);
  }

  label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--color-text);
    font-size: 0.95rem;
    white-space: nowrap;
    line-height: 1;
  }

  input[type='checkbox'] {
    appearance: none;
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.45);
    background: rgba(11, 27, 42, 0.6);
    display: inline-grid;
    place-content: center;
    cursor: pointer;
  }

  input[type='checkbox']::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    transform: scale(0);
    transition: transform 0.12s ease-in-out;
    background: var(--color-accent);
  }

  input[type='checkbox']:checked::before {
    transform: scale(1);
  }

  button {
    border: none;
    border-radius: var(--radius-2);
    padding: 0.65rem 2rem;
     background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
    color: var(--color-text);
    cursor: pointer;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
`;

export const List = styled.ul`
  list-style: none;
  margin-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: var(--radius-1);
    padding: var(--space-2) var(--space-3);
    background: rgba(5, 14, 22, 0.5);
  }
`;

export const InlineText = styled.p`
  color: var(--color-muted);
  font-size: 0.88rem;
`;

export const InfoText = styled.p`
  color: var(--color-text-accent);
  font-size: 0.88rem;
`;


export const TwoColumns = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
`;

export const SingleColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`;

export const TopActionBar = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: var(--space-2);

  button.secondary {
    border: none;
    border-radius: var(--radius-2);
    padding: 0.65rem 1rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.12);
    color: var(--color-text);
    cursor: pointer;
  }
`;

export const HighlightButton = styled.button`
  border: none;
  border-radius: var(--radius-2);
  padding: 0.7rem 1rem;
  font-weight: 700;
  background: linear-gradient(135deg, #ffba2b 0%, #ff7a18 100%);
  color: #1f1300;
  cursor: pointer;
`;

export const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  z-index: 1400;
`;

export const ModalCard = styled.div`
  position: fixed;
  z-index: 1500;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(92vw, 420px);
  background: rgba(8, 21, 33, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-3);
  padding: var(--space-4);
  box-shadow: var(--shadow-2);

  h3 {
    margin-bottom: var(--space-3);
  }

  input {
    width: 100%;
    border-radius: var(--radius-1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.6rem 0.75rem;
    background: rgba(11, 27, 42, 0.6);
    color: var(--color-text);
    margin-bottom: var(--space-3);
  }
`;
