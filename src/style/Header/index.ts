import styled from "styled-components";


export const HeaderStyle = styled.div`
    display: flex;
    width: 100vw;
    height: 180px;
    background-color: #001428;
    color: #FEFEFE;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    position: fixed;
    top: 0;
    z-index: 1000;
    border-bottom: #ACBCB7 solid 2px;
    gap: 8px;

    @media (max-width: 768px) {
      height: 140px;
      border-bottom: #ACBCB7 solid 2px;
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
    border: solid 2px  #274862;
    &:hover {
      border: solid 2px #FEFEFE;
    }
  }

  @media (max-width: 768px) {
    width: 100%;
  }
`;