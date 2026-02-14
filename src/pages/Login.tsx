import { useCallback, useRef, useState } from 'react';
import { FaEyeSlash, FaEye } from 'react-icons/fa';
import {
  BoxInput,
  BoxLogin,
  BoxPassword,
  BrandName,
  ButtonLogin,
  Container,
  FormHeader,
  FormSubtitle,
  FormTitle,
  HeroBadge,
  HeroDescription,
  HeroPanel,
  HeroTitle,
  InputLogin,
  LoginCard,
  LoginForm,
  SupportText,
  ErrorText,
} from '../style/Login';
import HumanVerification, {
  HumanVerificationHandle,
  HumanVerificationProvider,
} from '../components/ui/HumanVerification';
import axios from 'axios';
import { API_URL } from '../data';
import { useNavigate } from 'react-router-dom';
import verifyToken from '../utils/verifyToken';

const CAPTCHA_REQUIRED_ERROR = 'Conclua a verificação de segurança para continuar.';
const INVALID_CREDENTIALS_ERROR = 'Usuário ou senha inválidos.';
const TURNSTILE_VERIFICATION_ERROR = 'Não foi possível validar a verificação de segurança.';

function Login() {
  const [state, setState] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [captchaError, setCaptchaError] = useState('');
  const humanVerificationRef = useRef<HumanVerificationHandle | null>(null);
  const turnstilePreVerifyAvailableRef = useRef<boolean | null>(null);
  const navigate = useNavigate();
  const captchaProvider: HumanVerificationProvider = process.env.REACT_APP_TURNSTILE_SITE_KEY
    ? 'turnstile'
    : process.env.REACT_APP_RECAPTCHA_SITE_KEY
      ? 'recaptcha'
      : 'none';

  const onInputChange = ({ target: { name, value } }: any) => {
    if (errorMessage) setErrorMessage('');
    setState({ ...state, [name]: value });
  };

  const handleCaptchaTokenChange = useCallback((token: string) => {
    setCaptchaToken(token);
    if (!token) return;
    setErrorMessage((current) => (current === CAPTCHA_REQUIRED_ERROR ? '' : current));
  }, []);

  const handleEnter = async () => {
    if (!state.username.trim() || !state.password.trim()) {
      setErrorMessage('Preencha usuário e senha para continuar.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      if (captchaProvider !== 'none' && !captchaToken) {
        setErrorMessage(CAPTCHA_REQUIRED_ERROR);
        return;
      }

      let proofToUse = '';

      if (captchaProvider === 'turnstile') {
        const shouldTryPreVerify = turnstilePreVerifyAvailableRef.current !== false;

        if (shouldTryPreVerify) {
          try {
            const verifyResponse = await axios.post(`${API_URL}/api/verify-turnstile`, {
              token: captchaToken,
            });

            if (!verifyResponse.data?.success || !verifyResponse.data?.proof) {
              throw new Error(TURNSTILE_VERIFICATION_ERROR);
            }

            proofToUse = verifyResponse.data.proof;
            turnstilePreVerifyAvailableRef.current = true;
          } catch (verifyError) {
            if (axios.isAxiosError(verifyError) && verifyError.response?.status === 404) {
              // Backend antigo: segue com /login que já valida captcha.
              turnstilePreVerifyAvailableRef.current = false;
            } else {
              throw verifyError;
            }
          }
        }
      }

      const response = await axios.post(`${API_URL}/login`, {
        ...state,
        captchaToken,
        captchaProvider,
        captchaProof: proofToUse,
      });
      if (response) {
        const token = response.data.token;
        const permission = response.data?.data?.permission;
        const isValidToken = await verifyToken(token);
        if (isValidToken) {
          localStorage.setItem('token', token);
          if (permission) {
            localStorage.setItem('user_permission', permission);
          } else {
            localStorage.removeItem('user_permission');
          }
          navigate(permission === 'control_tower' ? '/control-tower/coletas' : '/home');
          return;
        }
      }
      setErrorMessage('Não foi possível validar o acesso. Tente novamente.');
    } catch (error) {
      setCaptchaToken('');
      humanVerificationRef.current?.reset();
      setCaptchaResetKey((prev) => prev + 1);
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        setErrorMessage(error.response.data.message);
      } else if (error instanceof Error && error.message) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(INVALID_CREDENTIALS_ERROR);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleEnter();
    }
  };

  return (
    <Container>
      <LoginCard>
        <HeroPanel>
          <HeroBadge>KP TRANSPORTES</HeroBadge>
          <HeroTitle>Logística inteligente para cargas sem parada.</HeroTitle>
          <HeroDescription>
            Controle operacional, rastreabilidade e performance em um único painel.
          </HeroDescription>
        </HeroPanel>

        <BoxLogin>
          <FormHeader>
            <BrandName>KP TRANSPORTES</BrandName>
            <FormTitle>Acesse sua operação</FormTitle>
            <FormSubtitle>Painel seguro para gestão de transporte de carga.</FormSubtitle>
          </FormHeader>

          <LoginForm>
            <BoxInput>
              <InputLogin
                type="text"
                name="username"
                id="username"
                value={ state.username }
                onChange={ onInputChange }
                onKeyDown={ onKeyDown }
                placeholder="Usuário"
                autoComplete="username"
              />
              <BoxPassword>
                {!showPassword ? <FaEye onClick={ () => handleShowPassword() } /> : <FaEyeSlash onClick={ () => handleShowPassword() }/>}
                <InputLogin
                  type={ !showPassword ? 'password' : 'text' }
                  name="password"
                  id="password"
                  value={ state.password }
                  onChange={ onInputChange }
                  onKeyDown={ onKeyDown }
                  placeholder="Senha"
                  autoComplete="current-password"
                />
              </BoxPassword>
              {errorMessage && <ErrorText>{errorMessage}</ErrorText>}
              {captchaError && <ErrorText>{captchaError}</ErrorText>}
            </BoxInput>
            <HumanVerification
              ref={humanVerificationRef}
              provider={captchaProvider}
              resetKey={captchaResetKey}
              onTokenChange={handleCaptchaTokenChange}
              onErrorChange={setCaptchaError}
            />
            <ButtonLogin
              type="button"
              onClick={ handleEnter }
              disabled={ isLoading || (captchaProvider !== 'none' && !captchaToken) }
            >
              {isLoading ? 'Entrando...' : 'Entrar no painel'}
            </ButtonLogin>
            <SupportText>Suporte interno KP TRANSPORTES</SupportText>
          </LoginForm>
        </BoxLogin>
      </LoginCard>
    </Container>
  );
}

export default Login;
