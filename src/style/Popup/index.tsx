import styled from "styled-components";


export const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  z-index: 998;
`;

export const PopupContainer = styled.div`
  display: flex;
  position: absolute;
  top: 20%;
  width: 60%;
  height: 50%;
  background: #2E2E3E;
  backdrop-filter: blur(8px);
  z-index: 999;

`;

export const PopupContent = styled.div`
  display: flex;
  position: relative;
  flex-direction: column;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: aliceblue;
  border: solid 2px #fff;
  border-radius: 8px;

  h2 {
    margin-bottom: 1.5rem;
    font-size: 2.5rem;
  }

`;

export const InputBox = styled.label`
  display: flex;
  align-items: center;
  width: 100%;
  flex-direction: column;
  gap: 8px;

  input {
    margin-bottom: 8px;
    width: 50%;
    padding: 6px;
    border-radius: 4px;
    border: none;
  }
`;

export const ButtonBox = styled.div`
  display: flex;
  justify-content: space-between;
  width: 52%;
  margin-top: 16px;
  
  button {
    width: 48%;
    padding: 8px;
    border-radius: 8px;
    border: solid 2px #fff;
    background-color: green;
    font-weight: bold;
    color: #FFFF;

    &:hover {
      border: solid 2px #256edb;
    }

    &.close {
      background-color: red;
      color: #000;
    }
  }
`;