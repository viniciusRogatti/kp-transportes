import { ChangeEvent, FormEvent, useCallback, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleHelp,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  BoxInput,
  BoxLogin,
  BoxPassword,
  ButtonLogin,
  Container,
  FormHeader,
  FormSubtitle,
  FormTitle,
  HeroBadge,
  HeroPanel,
  HeroTitle,
  InputLogin,
  LoginCard,
  LoginForm,
  PasswordToggle,
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
import { getDefaultRouteByPermission } from '../utils/permissions';

const CAPTCHA_REQUIRED_ERROR = 'Conclua a verificação de segurança para continuar.';
const INVALID_CREDENTIALS_ERROR = 'Usuário ou senha inválidos.';
const TURNSTILE_VERIFICATION_ERROR = 'Não foi possível validar a verificação de segurança.';
const APP_VERSION = process.env.REACT_APP_VERSION || '0.1.0';

const getSafeLoginError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Não foi possível conectar ao ambiente operacional. Verifique sua conexão e tente novamente.';
    if (error.response.status === 429) return 'Muitas tentativas de acesso. Aguarde um momento e tente novamente.';
    if ([401, 403].includes(error.response.status)) return INVALID_CREDENTIALS_ERROR;
    if (String(error.response.data?.code || '').toLowerCase().includes('captcha')) return TURNSTILE_VERIFICATION_ERROR;
    return 'Não foi possível concluir o acesso agora. Tente novamente.';
  }
  if (error instanceof Error && error.message === TURNSTILE_VERIFICATION_ERROR) return error.message;
  return INVALID_CREDENTIALS_ERROR;
};

function Login() {
  const [state, setState] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [captchaError, setCaptchaError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [loginPhase, setLoginPhase] = useState<'idle' | 'loading' | 'success'>('idle');
  const humanVerificationRef = useRef<HumanVerificationHandle | null>(null);
  const turnstilePreVerifyAvailableRef = useRef<boolean | null>(null);
  const navigate = useNavigate();
  const captchaProvider: HumanVerificationProvider = process.env.REACT_APP_TURNSTILE_SITE_KEY
    ? 'turnstile'
    : process.env.REACT_APP_RECAPTCHA_SITE_KEY
      ? 'recaptcha'
      : 'none';

  const onInputChange = ({ target: { name, value } }: ChangeEvent<HTMLInputElement>) => {
    if (errorMessage) setErrorMessage('');
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setState((current) => ({ ...current, [name]: value }));
  };

  const handleCaptchaTokenChange = useCallback((token: string) => {
    setCaptchaToken(token);
    if (!token) return;
    setErrorMessage((current) => (current === CAPTCHA_REQUIRED_ERROR ? '' : current));
  }, []);

  const handleEnter = async () => {
    if (isLoading) return;
    const normalizedUsername = state.username.trim();

    if (!normalizedUsername || !state.password.trim()) {
      setFieldErrors({
        username: normalizedUsername ? undefined : 'Informe seu usuário.',
        password: state.password.trim() ? undefined : 'Informe sua senha.',
      });
      setErrorMessage('Preencha usuário e senha para continuar.');
      return;
    }

    setIsLoading(true);
    setLoginPhase('loading');
    setErrorMessage('');
    setFieldErrors({});

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
        username: normalizedUsername,
        password: state.password,
        captchaToken,
        captchaProvider,
        captchaProof: proofToUse,
      });
      if (response) {
        const token = response.data.token;
        const permission = response.data?.data?.permission;
        const userName = response.data?.data?.name;
        const username = response.data?.data?.username;
        const companyId = response.data?.data?.companyId;
        const companyCode = response.data?.data?.companyCode;
        const companyName = response.data?.data?.companyName;
        const isValidToken = await verifyToken(token);
        if (isValidToken) {
          setLoginPhase('success');
          localStorage.setItem('token', token);
          if (permission) {
            localStorage.setItem('user_permission', permission);
          } else {
            localStorage.removeItem('user_permission');
          }
          if (userName) {
            localStorage.setItem('user_name', String(userName));
          } else {
            localStorage.removeItem('user_name');
          }
          if (username) {
            localStorage.setItem('user_login', String(username));
          } else {
            localStorage.removeItem('user_login');
          }
          if (companyId) {
            localStorage.setItem('company_id', String(companyId));
          } else {
            localStorage.removeItem('company_id');
          }
          if (companyCode) {
            localStorage.setItem('company_code', String(companyCode));
          } else {
            localStorage.removeItem('company_code');
          }
          if (companyName) {
            localStorage.setItem('company_name', String(companyName));
          } else {
            localStorage.removeItem('company_name');
          }

          navigate(getDefaultRouteByPermission(permission || ''));
          return;
        }
      }
      setErrorMessage('Não foi possível validar o acesso. Tente novamente.');
    } catch (error) {
      setCaptchaToken('');
      humanVerificationRef.current?.reset();
      setCaptchaResetKey((prev) => prev + 1);
      setErrorMessage(getSafeLoginError(error));
    } finally {
      setIsLoading(false);
      setLoginPhase((current) => (current === 'success' ? current : 'idle'));
    }
  };

  const handleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleEnter();
  };

  return (
    <Container id="kp-login-scene" data-phase={loginPhase}>
      <LoginCard>
        <HeroPanel>
          <div className="login-hero-topline">
            <div className="login-wordmark login-wordmark-light" aria-label="KP Transportes">
              <span className="login-monogram" aria-hidden="true">kp<span>.</span></span>
              <span className="login-wordmark-name">TRANSPORTES<span>Conectando caminhos.</span></span>
            </div>
            <span className="login-edition" aria-hidden="true">EM MOVIMENTO</span>
          </div>
          <div className="login-hero-copy">
            <HeroBadge>GENTE QUE MOVE O CAMINHO</HeroBadge>
            <HeroTitle>O próximo destino<br />começa <span>aqui.</span></HeroTitle>
          </div>
          <div className="login-hero-bottom">
            <div className="login-hero-caption">
              <span className="login-caption-line" aria-hidden="true" />
              <p>Compromisso em cada quilômetro.<br /><strong>Confiança em cada entrega.</strong></p>
            </div>
            <div className="login-hero-signature" aria-hidden="true"><ArrowUpRight /></div>
          </div>
        </HeroPanel>
        <BoxLogin>
          <div className="login-access-topline">
            <span className="login-platform-brand">KP<span> / </span>GESTÃO</span>
            <span className="login-access-badge"><LockKeyhole aria-hidden="true" />Acesso corporativo</span>
          </div>
          <div className="login-access-content">
            <FormHeader>
              <span className="login-welcome-label"><span aria-hidden="true" />SUA OPERAÇÃO, CONECTADA</span>
              <FormTitle>Bom ter você <br />de volta.</FormTitle>
              <FormSubtitle>Acesse sua conta e siga em frente<br className="login-desktop-break" /> com tudo sob controle.</FormSubtitle>
            </FormHeader>
            <LoginForm onSubmit={onSubmit} noValidate>
              <BoxInput>
                <label htmlFor="username">Usuário</label>
                <div className="login-field-wrap">
                  <UserRound className="login-field-icon" aria-hidden="true" />
                  <InputLogin
                    type="text" name="username" id="username" value={state.username}
                    onChange={onInputChange} placeholder="Digite seu usuário"
                    autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={isLoading}
                    aria-invalid={Boolean(fieldErrors.username)}
                    aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                  />
                </div>
                {fieldErrors.username && <span id="username-error" className="login-field-error">{fieldErrors.username}</span>}
              </BoxInput>
              <BoxInput>
                <label htmlFor="password">Senha</label>
                <BoxPassword>
                  <LockKeyhole className="login-field-icon" aria-hidden="true" />
                  <InputLogin
                    className="login-password-input" type={showPassword ? 'text' : 'password'}
                    name="password" id="password" value={state.password} onChange={onInputChange}
                    placeholder="Digite sua senha" autoComplete="current-password" disabled={isLoading}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  />
                  <PasswordToggle type="button" onClick={handleShowPassword} disabled={isLoading} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </PasswordToggle>
                </BoxPassword>
                {fieldErrors.password && <span id="password-error" className="login-field-error">{fieldErrors.password}</span>}
              </BoxInput>
              {errorMessage && <ErrorText>{errorMessage}</ErrorText>}
              {captchaError && <ErrorText>{captchaError}</ErrorText>}
              <HumanVerification
                ref={humanVerificationRef} provider={captchaProvider} resetKey={captchaResetKey} theme="light"
                onTokenChange={handleCaptchaTokenChange} onErrorChange={setCaptchaError}
              />
              <ButtonLogin type="submit" disabled={isLoading || (captchaProvider !== 'none' && !captchaToken)} aria-busy={isLoading}>
                {loginPhase === 'success' ? <><CheckCircle2 aria-hidden="true" />Acesso autorizado</>
                  : isLoading ? <><LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Validando acesso...</>
                    : <>Entrar no sistema<ArrowRight className="login-submit-arrow" aria-hidden="true" /></>}
              </ButtonLogin>
              <SupportText><ShieldCheck aria-hidden="true" />Seu acesso seguro. Sua operação em movimento.</SupportText>
            </LoginForm>
            <details className="login-help">
              <summary><CircleHelp aria-hidden="true" />Precisa de ajuda para entrar?</summary>
              <p>Esqueceu sua senha ou ainda não tem acesso? Fale com o administrador da sua empresa para recuperar suas credenciais ou solicitar uma conta.</p>
            </details>
          </div>
          <div className="login-access-footer">
            <span>Uma plataforma. Todos os caminhos.</span>
            <span className="login-footer-symbol" aria-hidden="true">↗</span>
          </div>
        </BoxLogin>
      </LoginCard>
      <footer className="login-page-footer">
        <span>© {new Date().getFullYear()} KP Transportes</span>
        <span>Plataforma de gestão logística <span aria-hidden="true">·</span> v{APP_VERSION}</span>
      </footer>
    </Container>
  );
}

export default Login;
