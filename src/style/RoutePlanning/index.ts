import styled from "styled-components";
import { motion } from "framer-motion";

export const ContainerRoutePlanning = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100vw;
  height: 100vh;
`;

export const ContainerForm = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  gap: 20px;
  color: #FEFEFE;
  
  button {
    width: 150px;
    padding: 8px 4px;
  }
`;

export const BoxButton = styled.div`
  display: flex;
  flex-wrap: wrap;
  width: fit-content;
  gap: 12px;
  margin-top: 10px;
  justify-content: center;

  button {
    width: 40%;
    border-radius: 4px;
    border: none;
    cursor: pointer;


    &.btn-add-danfe {
      background: #000025;
      border: solid 2px #22b6c1;
      color: #FEFEFE;
      opacity: 0.7;

      &:hover  {
        opacity: 1;
      }
    }
    
    &.btn-submit {
      background: #091944;
      border: solid 2px #22b6c1;
      color: #FEFEFE;
      opacity: 0.7;

      &:hover  {
        opacity: 1;
      }
    }
    
    &.btn-add-driver {
      background: #0e2653;
      border: solid 2px #22b6c1;
      color: #FEFEFE;
      opacity: 0.7;

      &:hover  {
        opacity: 1;
      }
    }
    
    &.btn-add-car {
      background: #123262;
      border: solid 2px #22b6c1;
      color: #FEFEFE;
      opacity: 0.7;

      &:hover  {
        opacity: 1;
      }
    }
  }
`;

export const BoxInfo = styled.div`
  display: flex;
  padding: 8px;
  width: 66%;
  gap: 70px;
  justify-content: start;
  align-items: center;
  
  p {
    font-size: 20px;
    font-weight: bold;
  }

  span {
    color: #22b6c1;
  }
`;

export const TitleRoutePlanning = styled.h1`
  text-align: center;
  margin-top: 5px;
  color: #FEFEFE;
`;

export const TripsContainer = styled(motion.ul)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  width: 95%;
  flex-wrap: wrap;
  transition: all 0.5s ease;

  .move-left {
    transform: translateX(-25%);
  }

  .move-right {
    transform: translateX(25%);
  }
`;

export const CardsTripsNotes = styled(motion.li)`
  display: flex;
  position: relative;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 20%;
  height: 200px;
  margin-top: 20px;
  border: solid 2px  #274862;
  border-radius: 12px;
  background: #FEFEFE;
  box-shadow: 4px 2px 12px #000000;
  color: #000000;

  h2 {
    position: absolute;
    top: 20px;
    left: 30%;
  }

  p {
    position: absolute;
    top: 8px;
    right: 12px;
    font-weight: bold;
  }

  h4 {
    text-overflow: ellipsis;
    white-space: wrap;
    overflow: hidden;
    text-align: center;
    max-width: 93%;
    font-size: 12px;
  }

  h5 {
    position: absolute;
    top: 8px;
    left: 12px;
    font-size: 22px;
    padding: 8px 14px;
    border-radius: 50%;
    border: solid 1px #000000;
  }

  h3 {
    margin-top: 8px;
    color: #001428;
  }

  button {
    position: absolute;
    border: none;
    width: fit-content;
    height: 20px;
    background: transparent;

    &.btn-left {
      left: 12px;
      bottom: 8px;
    }

    &.btn-right {
      right: 12px;
      bottom: 8px;
    }

    &.btn-remove {
      bottom: 8px;
      font-weight: bold;
      text-transform: capitalize;
    }

    svg {
      width: 24px;
      height: 24px;
    }
  }
`;

export const BoxDriverVehicle = styled.div`
  display: flex;
  flex-direction: column;
  align-items: start;
  justify-content: center;

  select {
    width: 11rem;
    padding: 4px;
    border: none;
    border-radius: 4px;
    background: #FEFEFE;
  }
`;

export const BoxSelectDanfe = styled.div`
  display: flex;
  flex-direction: column;
  align-items: start;
  justify-content: center;
  gap: 14px;

  input {
    width: 10rem;
    padding: 6px;
    border: none;
    border-radius: 4px;
  }
`;
