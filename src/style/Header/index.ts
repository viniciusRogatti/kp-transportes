import styled from "styled-components";

export const HeaderStyle = styled.div`
  display: flex;
  width: 100%;
  height: var(--header-height);
  background:
    linear-gradient(135deg, rgba(16, 39, 58, 0.95) 0%, rgba(10, 26, 41, 0.95) 100%);
  color: var(--color-text);
  align-items: center;
  justify-content: space-around;
  flex-direction: column;
  position: fixed;
  top: 0;
  z-index: 1000;
  border-bottom: 1px solid var(--color-border);
  gap: var(--space-2);
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-2);
  padding: var(--space-3) 0;

  h1 {
    font-size: clamp(1rem, 2vw, 1.6rem);
    letter-spacing: 0.08em;
  }

  @media (max-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);

    h1 {
      font-size: 18px;
    }
  }
`;

export const ContainerCards = styled.div`
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  width: 100%;
  padding: 0 var(--space-4);

  a {
    text-decoration: none;
    border-radius: var(--radius-2);
    border: 1px solid transparent;
    &:hover {
      border-color: rgba(255, 255, 255, 0.35);
    }
  }

  @media (max-width: 768px) {
    max-width: 100%;
    display: none;

    a {
      text-decoration: none;
    }
  }
`;

export const MobileMenuButton = styled.button`
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-2);
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(12, 27, 41, 0.7);
  color: var(--color-text);
  cursor: pointer;

  @media (max-width: 768px) {
    display: inline-flex;
  }
`;

export const MobileMenuOverlay = styled.div<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(4, 12, 20, 0.6);
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  pointer-events: ${({ $open }) => ($open ? "auto" : "none")};
  transition: opacity 0.2s ease;
  z-index: 1100;

  @media (min-width: 769px) {
    display: none;
  }
`;

export const MobileMenuPanel = styled.aside<{ $open: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  height: 100dvh;
  width: min(80vw, 320px);
  background: linear-gradient(180deg, #0b1b2a 0%, #0a1623 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: var(--space-6) var(--space-4);
  transform: translateX(${({ $open }) => ($open ? "0" : "-100%")});
  transition: transform 0.25s ease;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  h2 {
    font-size: 1rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  a {
    text-decoration: none;
  }

  nav a > div {
    width: 100%;
    justify-content: space-between;
    flex-direction: row-reverse;
  }

  nav a > div svg {
    width: 1.1rem;
    height: 1.1rem;
  }

  @media (min-width: 769px) {
    display: none;
  }
`;
