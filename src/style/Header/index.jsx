import styled from "styled-components";


export const HeaderStyle = styled.div`
    display: flex;
    width: 100vw;
    height: 180px;
    background-color: #2779a7;
    color: #ECD06F;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    position: fixed;
    top: 0;
    z-index: 1000;
    border-bottom: #ffffff solid 2px;
    gap: 8px;
`;

export const ContainerCards = styled.div`
  display: flex;
  width: 80%;
  justify-content: center;
  gap: 10px;
  
  
  a {
    text-decoration: none;
    gap: 2px;
    border: solid 2px #2779a7;
    border-radius: 12px;
  &:hover {
    border: solid 2px #ECD06F;
  }
  }
`;