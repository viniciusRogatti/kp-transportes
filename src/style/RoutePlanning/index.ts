import styled from "styled-components";
import { motion } from "framer-motion";

export const ContainerRoutePlanning = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  min-height: 100dvh;
`;

export const ContainerForm = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3);
  gap: var(--space-5);
  color: var(--color-text);
  width: min(100%, 1100px);
  flex-wrap: wrap;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
  }
`;

export const FormColumns = styled.div`
  display: grid;
  width: 100%;
  gap: var(--space-6);
  grid-template-columns: repeat(2, minmax(0, 1fr));
`;

export const FormColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;

  label {
    font-size: 0.9rem;
  }
`;

export const BoxButton = styled.div`
  display: flex;
  flex-wrap: wrap;
  width: fit-content;
  gap: var(--space-3);
  margin-top: var(--space-3);
  justify-content: center;

  @media (max-width: 768px) {
    width: 100%;
    order: 3;
  }
`;

export const ActionButton = styled.button<{ $tone: "primary" | "secondary" | "tertiary" | "quaternary" }>`
  width: 40%;
  border-radius: 4px;
  border: 1px solid var(--color-accent);
  cursor: pointer;
  color: var(--color-text);
  opacity: 0.8;
  padding: 6px 10px;

  background: ${({ $tone }) => {
    if ($tone === "primary") return "#1a3b66";
    if ($tone === "secondary") return "#123263";
    if ($tone === "tertiary") return "linear-gradient(135deg, #27c6b3 0%, #19a293 100%)";
    return "#123263";
  }};
  border-color: ${({ $tone }) => ($tone === "tertiary" ? "transparent" : "var(--color-accent)")};
  color: ${({ $tone }) => ($tone === "tertiary" ? "#04131e" : "var(--color-text)")};

  &:hover {
    opacity: 1;
  }

  @media (max-width: 768px) {
    width: 100%;
  }
`;

export const ActionsRow = styled.div`
  display: flex;
  gap: var(--space-3);
  width: 100%;
  justify-content: center;
  flex-wrap: wrap;

  ${ActionButton} {
    width: 32%;
  }

  @media (max-width: 768px) {
    ${ActionButton} {
      width: 100%;
    }
  }
`;

export const SubmitRow = styled.div`
  display: flex;
  width: 100%;
  justify-content: center;
  margin-top: var(--space-3);

  ${ActionButton} {
    width: min(100%, 360px);
  }
`;

export const BoxInfo = styled.div`
  display: flex;
  padding: var(--space-3);
  width: 66%;
  gap: var(--space-7);
  justify-content: start;
  align-items: center;
  
  p {
    font-size: 20px;
    font-weight: bold;
  }

  span {
    color: var(--color-accent);
  }
`;

export const TitleRoutePlanning = styled.h1`
  text-align: center;
  margin-top: var(--space-2);
  color: var(--color-text);
`;

export const TripsContainer = styled(motion.ul)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-5);
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
  flex: 1 1 240px;
  max-width: 320px;
  height: 200px;
  margin-top: var(--space-5);
  border: 1px solid rgba(12, 39, 60, 0.2);
  border-radius: var(--radius-3);
  background: var(--color-card);
  box-shadow: var(--shadow-1);
  color: #0b1b2a;

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
    margin-top: var(--space-2);
    color: #0b1b2a;
  }

`;

export const CardActionButton = styled.button<{ $variant: "left" | "right" | "remove" }>`
  position: absolute;
  border: none;
  width: fit-content;
  height: 20px;
  background: transparent;
  cursor: pointer;

  ${({ $variant }) => {
    if ($variant === "left") return "left: 12px; bottom: 8px;";
    if ($variant === "right") return "right: 12px; bottom: 8px;";
    return "bottom: 8px;";
  }}

  ${({ $variant }) => ($variant === "remove" ? "font-weight: bold; text-transform: capitalize;" : "")}

  svg {
    width: 24px;
    height: 24px;
  }
`;

export const BoxDriverVehicle = styled.div`
  display: flex;
  flex-direction: column;
  align-items: start;
  justify-content: center;
  width: 100%;
  gap: var(--space-2);

  select {
    width: 100%;
    padding: 6px;
    border: none;
    border-radius: var(--radius-1);
    background: #ffffff;
  }

`;

export const BoxSelectDanfe = styled.div`
  display: flex;
  flex-direction: column;
  align-items: start;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;

  input {
    width: 100%;
    padding: 6px;
    border: none;
    border-radius: var(--radius-1);
  }

`;

export const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
`;
