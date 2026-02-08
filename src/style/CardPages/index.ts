import styled from "styled-components";

export const CardPageStyle = styled.div`
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;
  width: max-content;
  min-width: 6.5rem;
  height: 2.25rem;
  border-radius: var(--radius-2);
  text-decoration: none;
  flex-direction: row;
  padding: 0.5rem 0.75rem;
  gap: 0.35rem;
  background: rgba(16, 39, 58, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.35);
    box-shadow: 0 8px 18px rgba(2, 12, 20, 0.35);
  }
  
  p {
    font-size: 12px;
    font-weight: 500;
    text-decoration: none;
    list-style: none;
    color: var(--color-text);
  }

  svg {
    width: 1.1rem;
    height: 1.1rem;
    cursor: pointer;
    color: inherit;
    fill: var(--color-text);
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    padding: 0.35rem 0.5rem;
    flex-direction: column;
    min-width: 4.2rem;
    height: auto;
    svg {
      width: 1rem;
      height: 1rem;
    }
    
    p {
      font-size: 0.55rem;
    }
  }
`;
