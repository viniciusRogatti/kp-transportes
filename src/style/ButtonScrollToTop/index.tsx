import styled from "styled-components";

interface IButtonScrollToTopStyle {
  isvisible: string;
}

export const ButtonScrollToTopStyle = styled.button<IButtonScrollToTopStyle>`
  display: ${(props) => (props.isvisible === 'true' ? 'block' : 'none')};
  position: fixed;
  bottom: 20px;
  right: 20px;
  font-size: 30px;
  padding: 10px;
  background-color: #ECF3FD;
  color: #2E2E3E;
  border: solid 2px black;
  border-radius: 50%;
  cursor: pointer;
`;