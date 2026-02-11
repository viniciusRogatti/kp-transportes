import { useState } from 'react';
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
import axios from 'axios';
import { API_URL } from '../data';
import { useNavigate } from 'react-router-dom';
import verifyToken from '../utils/verifyToken';

function Login() {
  const [state, setState] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const onInputChange = ({ target: { name, value } }: any) => {
    if (errorMessage) setErrorMessage('');
    setState({ ...state, [name]: value });
  };

  const handleEnter = async () => {
    if (!state.username.trim() || !state.password.trim()) {
      setErrorMessage('Preencha usuário e senha para continuar.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {      
      const response = await axios.post(`${API_URL}/login`, state);
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
          navigate('/home');
          return;
        }
      }
      setErrorMessage('Não foi possível validar o acesso. Tente novamente.');
    } catch (error) {
      setErrorMessage('Usuário ou senha inválidos.');
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
            </BoxInput>
            <ButtonLogin
              type="button"
              onClick={ handleEnter }
              disabled={ isLoading }
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
