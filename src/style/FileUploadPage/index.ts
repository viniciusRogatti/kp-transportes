import styled from "styled-components";

export const BoxInput = styled.div`
  display: flex;
  gap: 8px;
  color: #f0f0f0;

  .inputfile {
    width: 0.1px;
    height: 0.1px;
    opacity: 0;
    overflow: hidden;
    position: absolute;
    z-index: -1;
  }

  .custom-file-upload {
    border: 1px solid #ccc;
    display: inline-block;
    padding: 6px 12px;
    cursor: pointer;
    background-color: #f0f0f0;
    border-radius: 4px;
    color: #000;
  }

  button {
    padding: 6px 12px;
    color: #000;
    cursor: pointer;
  }
`;

export const BoxMessage = styled.div`
  padding: 12px;
  color: #fefefe;
`;