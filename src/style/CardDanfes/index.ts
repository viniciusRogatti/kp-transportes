import styled from "styled-components";

export const ContainerCards = styled.div`
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-5);
  max-width: 1200px;
  margin: 0 auto;
`;


export const CardsDanfe = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: start;
  align-items: center;
  width: 100%;
  max-width: 360px;
  min-height: 360px;
  border: 1px solid rgba(12, 39, 60, 0.2);
  position: relative;
  padding: var(--space-2) var(--space-4);
  background-color: var(--color-card);
  border-radius: var(--radius-3);
  box-shadow: var(--shadow-1);
  color: #0b1b2a;

  h4 {
    font-size: 12px;
    position: relative;
  }

  p { 
    font-size: 10px;
  }

  h4 {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    max-width: 18.75rem;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    min-height: 280px;
    width: 100%;
    max-width: 420px;

    h4, p {
      font-size: 0.7rem;
    }
  }
`;

export const DescriptionColumns = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: bold;

  @media (max-width: 768px) {
    font-size: 10px;
  }
`;

export const ContainerItems = styled.div`
  display: flex;
  flex-direction: column;
  overflow-Y: auto;
  margin-top: var(--space-3);
  max-height: 60%;
  width: 100%;
  padding: var(--space-3);
  gap: var(--space-3);
  border: 1px solid rgba(12, 39, 60, 0.2);
  border-radius: var(--radius-2);

`;

export const ListItems = styled.ul`
  display: flex;
  align-items: center;
  justify-content: space-between;
  list-style: none;
  border-bottom: 1px solid rgba(12, 39, 60, 0.2);
  font-size: 14px;
  font-weight: bold;
  gap: var(--space-2);

  li {

      &:nth-child(2) {
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;   
      max-width: 250px;
      font-weight: initial;
    }
  }

  @media (max-width: 768px) {
    font-size: 0.7rem;
  }
`;

export const TitleCard = styled.div`
  display: flex;
  position: relative;
  width: 100%;
  height: 50px;

  h1 {
    position: absolute;
    margin: 0;
    top: 4px;
    left: 4px;
  }

  h1::before { 
    content: 'NF ';
    font-size: 20px;
  }

  h4 {
    position: absolute;
    margin: 0;
    top: 8px;
    right: 4px;
    color: #0b1b2a;
    font-size: large;
    font-weight: bold;
  }

  h4, h1 {
    font-size: 18px;
    font-weight: bold;
  }

  @media (max-width: 768px) {
    h4, h1 {
      font-size: 12px;
      font-weight: bold;
    }
    h1::before { 
      content: 'NF ';
      font-size: 12px;
    }
  }
`;

export const TotalQuantity = styled.div`

  position: absolute;
  bottom: 8px;
  
  p {
    font-size: 18px;
    font-weight: bold;
  }

  ::before {
    content: 'Quantidade Total: ';
  }

  @media (max-width: 768px) {
    p {
      font-size: 12px;
      font-weight: bold;
    }
  }
`;
