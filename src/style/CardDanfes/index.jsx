import styled from "styled-components";

export const ContainerCards = styled.div`
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
`;

export const CardsDanfe = styled.div`
  display: flex;
  justify-content: start;
  align-items: center;
  flex-direction: column;
  width: 350px;
  height: 400px;
  border: solid 2px #2779a7;
  position: relative;
  padding: 2px 12px;
  background-color: #ecd16f;
  border-radius: 12px;
  box-shadow:  4px 4px 20px #2779a7,
  -4px -4px 15px #000000;

  p {
    font-size: 12px;
    position: relative;
  }

  h4 {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;   
    max-width: 300px;
  }

`;

export const DescriptionColumns = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: bold;
`;

export const ContainerItems = styled.div`
  display: flex;
  flex-direction: column;
  overflow-Y: auto;
  margin-top: 10px;
  max-height: 60%;
  width: 95%;
  padding: 8px 4px;
  gap: 14px;
  border: solid 1px black;
  border-radius: 8px;
`;

export const ListItems = styled.ul`
  display: flex;
  align-items: center;
  justify-content: space-between;
  list-style: none;
  border-bottom: solid 1px black;  
  font-size: 14px;
  font-weight: bold;
  gap: 4px;

  li {

      &:nth-child(2) {
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;   
      max-width: 250px;
      font-weight: initial;
    }
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
    color: black;
    font-size: large;
    font-weight: bold;
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
`;