import styled from 'styled-components';
import VolksImage from '../../assets/images/volks.png';
export const Container = styled.section`
  --login-deep: #051320;
  --login-mid: #0b243a;
  --login-cyan: #27c6b3;
  --login-cyan-strong: #17a694;
  --login-glass: rgba(7, 25, 42, 0.8);
  --login-border: rgba(122, 172, 214, 0.24);

  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  width: 100%;
  padding: var(--space-7) var(--space-4);
  position: relative;
  overflow: hidden;

  background:
    radial-gradient(920px 460px at -10% -10%, rgba(39, 198, 179, 0.23) 0%, transparent 70%),
    radial-gradient(780px 360px at 105% 0%, rgba(14, 93, 174, 0.2) 0%, transparent 70%),
    linear-gradient(140deg, var(--login-deep) 0%, var(--login-mid) 60%, #0e2d45 100%);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(76, 122, 163, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(76, 122, 163, 0.08) 1px, transparent 1px);
    background-size: 42px 42px;
    mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.22), transparent 75%);
    pointer-events: none;
  }
`;

export const LoginCard = styled.div`
  display: grid;
  grid-template-columns: minmax(360px, 1.1fr) minmax(320px, 0.9fr);
  width: min(1080px, 94vw);
  min-height: min(680px, 90dvh);
  border-radius: 26px;
  overflow: hidden;
  border: 1px solid var(--login-border);
  box-shadow: 0 22px 48px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  position: relative;
  z-index: 1;

  @media only screen and (max-width: 950px) {
    grid-template-columns: 1fr;
    min-height: unset;
  }
`;

export const HeroPanel = styled.aside`
  position: relative;
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: var(--space-4);
  min-height: 420px;

  background:
    linear-gradient(to top, rgba(4, 14, 26, 0.78), rgba(8, 25, 41, 0.35)),
    url(${VolksImage}) right / cover no-repeat;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(130deg, rgba(39, 198, 179, 0.12), transparent 62%);
  }

  @media only screen and (max-width: 950px) {
    min-height: 300px;
    padding: var(--space-6);
  }

  @media only screen and (max-width: 560px) {
    min-height: 260px;
    padding: var(--space-5);
    justify-content: flex-end;
  }
`;

export const HeroBadge = styled.span`
  position: relative;
  z-index: 1;
  width: fit-content;
  padding: 8px 14px;
  border-radius: 999px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.72rem;
  font-weight: 700;
  color: #dff8ff;
  border: 1px solid rgba(213, 250, 255, 0.35);
  background: rgba(4, 18, 31, 0.56);
`;

export const HeroTitle = styled.h1`
  position: relative;
  z-index: 1;
  display: block;
  color: #f5fbff;
  max-width: 420px;
  font-size: clamp(1.5rem, 1.2rem + 1.1vw, 2.3rem);
  line-height: 1.15;
  text-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
`;

export const HeroDescription = styled.p`
  position: relative;
  z-index: 1;
  max-width: 390px;
  color: rgba(235, 247, 255, 0.9);
  font-size: 0.95rem;
  line-height: 1.5;
`;

export const BoxLogin = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  width: 100%;
  min-height: 100%;
  padding: var(--space-8);
  background:
    radial-gradient(120% 140% at 0% 0%, rgba(22, 50, 74, 0.34) 0%, transparent 55%),
    radial-gradient(100% 120% at 100% 100%, rgba(12, 36, 56, 0.36) 0%, transparent 58%),
    linear-gradient(160deg, #061019 0%, #071827 55%, #0a2133 100%);

  @media only screen and (max-width: 950px) {
    min-height: 440px;
    padding: var(--space-6);
  }

  @media only screen and (max-width: 560px) {
    padding: var(--space-5);
    min-height: 430px;
  }
`;

export const ButtonLogin = styled.button`
  background: linear-gradient(135deg, var(--login-cyan) 0%, var(--login-cyan-strong) 100%);
  border-radius: 12px;
  width: 100%;
  height: 48px;
  border: none;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #04131e;
  border: 1px solid rgba(255, 255, 255, 0.18);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 22px rgba(18, 198, 179, 0.2);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

export const BoxInput = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
`;

export const InputLogin = styled.input`
  width: 100%;
  height: 48px;
  border-radius: 12px;
  padding: 0 16px;
  color: #e8f5ff;
  background-color: rgba(8, 24, 37, 0.8);
  border: 1px solid rgba(156, 197, 232, 0.3);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;

  ::placeholder {
    color: #9cb5c9;
  }

  &:focus {
    border-color: rgba(61, 223, 205, 0.85);
    box-shadow: 0 0 0 4px rgba(39, 198, 179, 0.2);
    background-color: rgba(10, 31, 48, 0.9);
  }
`;

export const BoxPassword = styled.div`
  position: relative;
  width: 100%;
  display: flex;

  svg {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #a8c6df;
    cursor: pointer;
  }
`;

export const FormHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
`;

export const BrandName = styled.span`
  width: fit-content;
  color: #ddf5ff;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(166, 213, 247, 0.34);
  background: rgba(9, 30, 49, 0.5);
`;

export const FormTitle = styled.h2`
  display: block;
  color: #f2fbff;
  font-size: clamp(1.4rem, 1.1rem + 0.9vw, 2rem);
  line-height: 1.15;
`;

export const FormSubtitle = styled.p`
  color: #9eb7ca;
  font-size: 0.93rem;
  line-height: 1.45;
  max-width: 340px;
`;

export const LoginForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: min(100%, 340px);
`;

export const ErrorText = styled.span`
  color: #ff9e9e;
  font-size: 0.84rem;
  font-weight: 600;
  margin-top: 2px;
`;

export const SupportText = styled.span`
  color: #7f9cb2;
  font-size: 0.8rem;
  text-align: center;
`;
