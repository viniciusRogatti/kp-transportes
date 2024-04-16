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
    color: #ECF3FD;
  }

  svg {
    width: 28px;
    height: 28px;
    cursor: pointer;
    list-style: none;
    text-decoration: none;
    color: inherit;
    fill:  #ECF3FD;

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
    font-size: 6px;
  }
  }

`;