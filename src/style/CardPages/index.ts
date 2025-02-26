import styled from "styled-components";

export const CardPageStyle = styled.div`
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: start;
  width: max-content;
  min-width: 4rem;
  height: 1.5rem;
  border-radius: 4px;
  text-decoration: none;
  flex-direction: row;
  padding: 0.625rem;
  gap: 2px;
  
  p {
    font-size: 12px;
    text-decoration: none;
    list-style: none;
    color: #FEFEFE;
  }

  svg {
    width: 1.5rem;
    height: 1.5rem;
    cursor: pointer;
    color: inherit;
    fill: #FEFEFE;
  }

  @media (max-width: 768px) {
    padding: 2px;
    flex-direction: column;
    min-width: 3rem;
    height: fit-content;
    svg {
      width: 1rem;
      height: 1rem;
    }
    
    p {
      font-size: 6px;
    }
  }
`;