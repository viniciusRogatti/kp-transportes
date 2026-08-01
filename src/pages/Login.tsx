import { FormEvent, KeyboardEvent, useCallback, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Route,
  ShieldCheck,
  Truck,
  UserRound,
} from 'lucide-react';
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
import ThemeToggleButton from '../components/ui/ThemeToggleButton';

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
  const [focusedField, setFocusedField] = useState<'none' | 'username' | 'password'>('none');
  const [routePausedByClick, setRoutePausedByClick] = useState(false);
  const humanVerificationRef = useRef<HumanVerificationHandle | null>(null);
  const turnstilePreVerifyAvailableRef = useRef<boolean | null>(null);
  const flowSvgRef = useRef<SVGSVGElement | null>(null);
  const navigate = useNavigate();
  const captchaProvider: HumanVerificationProvider = process.env.REACT_APP_TURNSTILE_SITE_KEY
    ? 'turnstile'
    : process.env.REACT_APP_RECAPTCHA_SITE_KEY
      ? 'recaptcha'
      : 'none';

  const onInputChange = ({ target: { name, value } }: any) => {
    if (errorMessage) setErrorMessage('');
    setRoutePausedByClick(false);
    flowSvgRef.current?.unpauseAnimations?.();
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setState({ ...state, [name]: value });
  };

  const pauseRoute = () => {
    flowSvgRef.current?.pauseAnimations?.();
  };

  const pauseRouteByClick = () => {
    setRoutePausedByClick(true);
    pauseRoute();
  };

  const resumeRouteAfterHover = () => {
    if (!routePausedByClick) flowSvgRef.current?.unpauseAnimations?.();
  };

  const handleRouteKeyDown = (event: KeyboardEvent<SVGPathElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    pauseRouteByClick();
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
    <Container
      id="kp-login-scene"
      data-focus={focusedField}
      data-phase={loginPhase}
      data-traffic-paused={routePausedByClick ? 'true' : 'false'}
    >
      <LoginCard>
        <HeroPanel>
          <div className="login-brand absolute top-[clamp(22px,4vw,58px)] z-20 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/25 bg-slate-950/45 shadow-lg">
              <Truck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">KP Transportes</p>
              <p className="mt-0.5 text-sm text-slate-300">Plataforma logística integrada</p>
            </div>
          </div>

          <div className="login-hero-copy absolute bottom-[clamp(40px,7vh,88px)] z-20 space-y-4">
            <HeroBadge>Central de comando operacional</HeroBadge>
            <HeroTitle>Controle, rastreabilidade e eficiência em cada operação.</HeroTitle>
            <HeroDescription>
              Da entrada dos documentos à comprovação da entrega, cada etapa conectada em um fluxo seguro e auditável.
            </HeroDescription>
            <div className="flex flex-wrap gap-2 max-[640px]:hidden" aria-label="Recursos da plataforma">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/40 px-3 py-1.5 text-xs text-slate-200"><Route className="h-3.5 w-3.5" />Rotas conectadas</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/40 px-3 py-1.5 text-xs text-slate-200"><ShieldCheck className="h-3.5 w-3.5" />Operação auditável</span>
            </div>
          </div>

          <svg ref={flowSvgRef} className="login-flow-signature" aria-label="Rota interativa com caminhões em movimento" viewBox="0 0 1600 900" preserveAspectRatio="none">
            <defs>
              <filter id="login-flow-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path id="kp-login-flow-path" pathLength="1" className="login-flow-track" d="M-30 678 C170 678 156 458 338 458 C494 458 466 642 632 642 C805 642 758 272 960 272 C1135 272 1092 704 1312 704 C1458 704 1486 578 1630 578" />
            <path pathLength="1" className="login-flow-active" d="M-30 678 C170 678 156 458 338 458 C494 458 466 642 632 642 C805 642 758 272 960 272 C1135 272 1092 704 1312 704 C1458 704 1486 578 1630 578" />
            <path
              className="login-flow-hit-area"
              d="M-30 678 C170 678 156 458 338 458 C494 458 466 642 632 642 C805 642 758 272 960 272 C1135 272 1092 704 1312 704 C1458 704 1486 578 1630 578"
              role="button"
              tabIndex={0}
              aria-label="Pausar caminhões da rota"
              onClick={pauseRouteByClick}
              onKeyDown={handleRouteKeyDown}
              onPointerEnter={pauseRoute}
              onPointerLeave={resumeRouteAfterHover}
            />
            <g
              className="login-route-traffic"
              onClick={pauseRouteByClick}
              onPointerEnter={pauseRoute}
              onPointerLeave={resumeRouteAfterHover}
            >
              {[
                { begin: '-1s', duration: '13s', tone: 'primary' },
                { begin: '-5.33s', duration: '13s', tone: 'secondary' },
                { begin: '-9.66s', duration: '13s', tone: 'muted' },
              ].map((truck) => (
                <g className="login-route-truck-motion" key={truck.begin}>
                  <g className={`login-route-truck login-route-truck-${truck.tone}`}>
                    <rect className="login-route-truck-box" x="-18" y="-8" width="25" height="16" rx="2" />
                    <path className="login-route-truck-cab" d="M7-8H13L19-4V4L13 8H7Z" />
                    <path className="login-route-truck-glass" d="M12-5L16-3V3L12 5Z" />
                    <rect className="login-route-truck-wheel" x="-13" y="-10" width="6" height="3" rx="1" />
                    <rect className="login-route-truck-wheel" x="-13" y="7" width="6" height="3" rx="1" />
                    <rect className="login-route-truck-wheel" x="9" y="-10" width="6" height="3" rx="1" />
                    <rect className="login-route-truck-wheel" x="9" y="7" width="6" height="3" rx="1" />
                  </g>
                  <animateMotion begin={truck.begin} dur={truck.duration} repeatCount="indefinite" rotate="auto">
                    <mpath href="#kp-login-flow-path" />
                  </animateMotion>
                </g>
              ))}
            </g>
            {[
              [150, 577], [338, 458], [632, 642], [960, 272], [1312, 704], [1490, 602],
            ].map(([cx, cy], index) => (
              <g className={`login-flow-node login-flow-node-${index + 1}`} key={`${cx}-${cy}`}>
                <circle cx={cx} cy={cy} r="16" className="login-flow-node-ring" />
                <circle cx={cx} cy={cy} r="5" className="login-flow-node-core" />
              </g>
            ))}
          </svg>
          <span className="login-traffic-hint" aria-live="polite">Rota pausada · digite para liberar</span>
          <p className="sr-only">Fluxo operacional KP: entrada, organização, rota, entrega, retorno e registro.</p>
        </HeroPanel>

        <BoxLogin>
          <div aria-hidden="true" className="login-document-index absolute left-0 top-10 flex flex-col items-center gap-2 text-[0.58rem] font-bold tracking-[0.15em]"><span>KP</span><i /><span>01—06</span></div>
          <div className="absolute right-5 top-5">
            <ThemeToggleButton iconOnly />
          </div>
          <FormHeader>
            <BrandName>Ambiente operacional protegido</BrandName>
            <FormTitle>Bem-vindo à operação</FormTitle>
            <FormSubtitle>Use suas credenciais corporativas para acessar os recursos autorizados ao seu perfil.</FormSubtitle>
          </FormHeader>

          <LoginForm onSubmit={onSubmit} noValidate>
            <BoxInput>
              <label htmlFor="username">Usuário</label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--login-text-secondary)]" aria-hidden="true" />
                <InputLogin
                  className="pl-11"
                  type="text"
                  name="username"
                  id="username"
                  value={state.username}
                  onChange={onInputChange}
                  placeholder="Seu usuário de acesso"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={isLoading}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField('none')}
                  aria-invalid={Boolean(fieldErrors.username)}
                  aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                />
              </div>
              {fieldErrors.username && <span id="username-error" className="text-xs font-semibold text-[var(--login-error)]">{fieldErrors.username}</span>}
              <label htmlFor="password">Senha</label>
              <BoxPassword>
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--login-text-secondary)]" aria-hidden="true" />
                <InputLogin
                  className="px-11"
                  type={!showPassword ? 'password' : 'text'}
                  name="password"
                  id="password"
                  value={state.password}
                  onChange={onInputChange}
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  disabled={isLoading}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField('none')}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                />
                <PasswordToggle type="button" onClick={handleShowPassword} disabled={isLoading} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </PasswordToggle>
              </BoxPassword>
              {fieldErrors.password && <span id="password-error" className="text-xs font-semibold text-[var(--login-error)]">{fieldErrors.password}</span>}
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
              type="submit"
              disabled={isLoading || (captchaProvider !== 'none' && !captchaToken)}
              aria-busy={isLoading}
            >
              {loginPhase === 'success' ? <><CheckCircle2 className="h-4 w-4" />Acesso autorizado</>
                : isLoading ? <><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />Validando acesso...</>
                  : <><LockKeyhole className="h-4 w-4" />Entrar no sistema</>}
            </ButtonLogin>
            <SupportText>
              Acesso restrito a usuários autorizados<br />
              <span className="text-[0.68rem]">KP Transportes · versão {APP_VERSION}</span>
            </SupportText>
          </LoginForm>
        </BoxLogin>
      </LoginCard>
    </Container>
  );
}

export default Login;
