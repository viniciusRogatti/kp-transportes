import styled from "styled-components";


export const HeaderStyle = styled.div`
    display: flex;
    width: 100vw;
    height: 180px;
    background-color: #2E2E3E;
    color: #ECF3FD;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    position: fixed;
    top: 0;
    z-index: 1000;
    border-bottom: #ffffff solid 2px;
    gap: 8px;

    @media (max-width: 768px) {
      height: 140px;
      border-bottom: #ffffff solid 2px;
      h1 {
        font-size: 20px;
      }
  }
`;

export const ContainerCards = styled.div`
  display: flex;
  width: 80%;
  justify-content: center;
  gap: 10px;
  
  
  a {
    text-decoration: none;
    gap: 2px;
    border-radius: 12px;
    border: solid 2px  #2E2E3E;
    &:hover {
    border: solid 2px #256edb;
  }
  }

  @media (max-width: 768px) {
    width: 100%;
  }
`;