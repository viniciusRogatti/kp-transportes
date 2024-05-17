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
  width: 50%;
  gap: 8px;
  margin-top: 18px;

  button {
    width: 40%;
    border-radius: 4px;
    border: none;
    cursor: pointer;
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

  h2 {
    position: absolute;
    top: 8px;
    left: 12px;
  }

  p {
    position: absolute;
    top: 8px;
    right: 12px;
    font-weight: bold;
  }

  h4 {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    max-width: 95%;
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
