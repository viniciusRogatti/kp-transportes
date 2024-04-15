import styled from "styled-components";

export const CardPageStyle = styled.div`
  width: 150px;
  height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  text-decoration: none;
  gap: 12px;
  
  p {
    text-decoration: none;
    list-style: none;
    color: black;
  }

  svg {
    width: 28px;
    height: 28px;
    cursor: pointer;
    list-style: none;
    text-decoration: none;
    color: inherit;
    fill:  #ECD06F;

  }


  @media (max-width: 768px) {
    width: auto;
    height: auto;
    gap: 6px;
    svg {
      width: 16px;
      height: 16px;
    }
    p {
    font-size: 8px;
  }
  }

`;