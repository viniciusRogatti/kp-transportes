import styled from "styled-components";

export const HeaderStyle = styled.div`
  display: flex;
  width: 100%;
  height: 180px;
  background-color: #001428;
  color: #FEFEFE;
  align-items: center;
  justify-content: space-around;
  flex-direction: column;
  position: fixed;
  top: 0;
  z-index: 1000;
  border-bottom: #ACBCB7 solid 2px;
  gap: 8px;

  @media (max-width: 768px) {
    height: 140px;
    h1 {
      font-size: 20px;
    }
  }
`;

export const ContainerCards = styled.div`
  display: flex;
  justify-content: center;
  gap: 0.625rem;
  width: 100%;
  margin-top: 10px;

  a {
    text-decoration: none;
    border-radius: 12px;
    border: solid 2px #274862;
    &:hover {
      border: solid 2px #FEFEFE;
    }
  }

  @media (max-width: 768px) {
    max-width: 100%;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.2rem;

    a {
    text-decoration: none;
    &:hover {
      border: solid 2px #FEFEFE;
    }
  }
  }
`;
