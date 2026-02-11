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
  width: 100%;
  padding: 6px 0;
  border-radius: var(--radius-2);
  background: transparent;

  button {
    flex: 1;
    height: 2.5rem;
    border-radius: var(--radius-2);
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: linear-gradient(180deg, rgba(15, 33, 49, 0.95) 0%, rgba(10, 24, 37, 0.95) 100%);
    color: rgba(226, 242, 255, 0.96);
    cursor: pointer;
    font-weight: 600;
    transform: translateY(-2px);
    box-shadow:
      0 6px 12px rgba(0, 0, 0, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transition:
      transform 0.22s cubic-bezier(0.2, 0.7, 0.2, 1),
      box-shadow 0.22s cubic-bezier(0.2, 0.7, 0.2, 1),
      background 0.22s cubic-bezier(0.2, 0.7, 0.2, 1),
      border-color 0.22s cubic-bezier(0.2, 0.7, 0.2, 1),
      color 0.22s cubic-bezier(0.2, 0.7, 0.2, 1);
  }

  button:hover {
    transform: translateY(-1px);
  }

  button:active {
    transform: translateY(2px);
    box-shadow:
      inset 0 2px 8px rgba(0, 0, 0, 0.32),
      inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  }

  button.active {
    background: rgba(8, 21, 33, 0.98);
    color: var(--color-text);
    border-color: rgba(255, 255, 255, 0.09);
    transform: translateY(1px);
    box-shadow:
      inset 0 2px 6px rgba(0, 0, 0, 0.34),
      inset 0 0 0 1px rgba(255, 255, 255, 0.04);
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
    min-width: 0;
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
  flex-wrap: nowrap;
  min-width: 0;

  input[type='number'] {
    width: 130px;
    min-width: 0;
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
    font-size: 0.92rem;
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
    gap: var(--space-2);
    align-items: center;
    overflow-x: auto;
    padding-bottom: 2px;

    input[type='number'] {
      width: 96px;
      padding: 0.55rem 0.6rem;
    }

    button {
      padding: 0.55rem 0.9rem;
      white-space: nowrap;
    }

    label {
      font-size: 0.85rem;
      gap: 0.35rem;
    }
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
    min-width: 0;
    gap: var(--space-3);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: var(--radius-1);
    padding: var(--space-2) var(--space-3);
    background: rgba(5, 14, 22, 0.5);
  }

  li > span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;

export const OccurrenceItemContent = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
`;

export const OccurrenceActionsRow = styled.div`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-2);
`;

export const OccurrenceActionsLeft = styled.div`
  display: flex;
  gap: var(--space-2);

  button {
    border: none;
    border-radius: var(--radius-2);
    padding: 0.65rem 1rem;
    cursor: pointer;
    font-weight: 600;
  }

  .primary {
    background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
    color: #04131e;
  }
`;

export const OccurrenceActionsRight = styled.div`
  display: flex;
  gap: var(--space-2);

  button {
    border: none;
    border-radius: var(--radius-2);
    padding: 0.65rem 1rem;
    cursor: pointer;
    font-weight: 600;
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

export const BatchItemContent = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
`;

export const BatchActionsRow = styled.div`
  width: 100%;
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

  .primary {
    background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
    color: #04131e;
  }

  .secondary {
    background: rgba(255, 255, 255, 0.12);
    color: var(--color-text);
  }
`;

export const ListHeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-2);
  margin-top: 18px;

  h2 {
    margin-bottom: 0;
  }
`;

export const CardHeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;

  h2 {
    margin-bottom: 0;
  }

  button {
    border: none;
    border-radius: var(--radius-2);
    padding: 0.65rem 1rem;
    cursor: pointer;
    font-weight: 600;
  }

  .secondary {
    background: rgba(255, 255, 255, 0.12);
    color: var(--color-text);
  }
`;

export const SaveBatchButton = styled.button`
  border: none;
  border-radius: var(--radius-2);
  padding: 0.65rem 1rem;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, #3ecf6d 0%, #23a455 100%);
  color: #062611;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
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
