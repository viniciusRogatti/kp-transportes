import { useState } from 'react';
import { FaEyeSlash, FaEye } from 'react-icons/fa';
import { BoxLogin, Container, ButtonLogin, InputLogin, BoxPassword, BoxInput } from '../style/Login';
import axios from 'axios';
import { API_URL } from '../data';
import { useNavigate } from 'react-router-dom';
import verifyToken from '../utils/verifyToken';

function Login() {
  const [state, setState] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const onInputChange = ({ target: { name, value } }: any) => {
    setState({ ...state, [name]: value });
  };

  const handleEnter = async () => {
    try {      
      const response = await axios.post(`${API_URL}/login`, state);
      if (response) {
        const token = response.data.token;
        const isValidToken = await verifyToken(token);
        localStorage.setItem('token', token);
        if (isValidToken) {
          navigate('/home');
        }
      }
      
    } catch (error) {
      console.log(error);
    }
  };

  const handleShowPassword = () => {
    setShowPassword(!showPassword);
  }

  return (
    <Container>
      <BoxLogin>
        <BoxInput>
          <InputLogin
            type="text"
            name="username"
            id="username"
            value={ state.username }
            onChange={ onInputChange }
            placeholder="Username"
          />
          <BoxPassword>
            {!showPassword ? <FaEye onClick={ () => handleShowPassword() } /> : <FaEyeSlash onClick={ () => handleShowPassword() }/>}
            <InputLogin
              type={ !showPassword ? 'password' : 'text' }
              name="password"
              id="password"
              value={ state.password }
              onChange={ onInputChange }
              placeholder="Password"
            />
          </BoxPassword>
          <ButtonLogin
            type="button"
            onClick={ handleEnter }
          >
            Enter
          </ButtonLogin>
        </BoxInput>
      </BoxLogin>
    </Container>
  );
}

export default Login;
