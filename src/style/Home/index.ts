import styled from "styled-components";


export const HomeStyle = styled.div`
  display: flex;
  position: relative;
  flex-direction: column;
  align-items: center;
  justify-content: start;
  width: 100%;
  min-height: 100dvh;
  background: transparent;
`;

export const HomeContent = styled.div`
  width: min(1100px, 100%);
  padding: calc(var(--header-height) + var(--space-5)) var(--space-5) var(--space-7);
`;

export const OccurrenceCard = styled.section`
  background: rgba(8, 21, 33, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-3);
  padding: var(--space-4);
  box-shadow: var(--shadow-2);

  h2 {
    margin-bottom: var(--space-3);
  }

  p {
    color: var(--color-muted);
  }
`;

export const OccurrenceList = styled.ul`
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-1);
    background: rgba(4, 14, 22, 0.45);
  }

  strong {
    display: block;
    margin-bottom: var(--space-1);
  }

  small {
    display: block;
    margin-top: var(--space-1);
    color: var(--color-muted);
  }

  button {
    border: none;
    border-radius: var(--radius-1);
    padding: 0.55rem 0.8rem;
    background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
    color: #04131e;
    cursor: pointer;
    font-weight: 600;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    li {
      flex-direction: column;
      align-items: flex-start;
    }
  }
`;
