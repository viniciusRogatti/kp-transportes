import axios from "axios";
import { API_URL } from "../data";

const verifyToken = async (token: string) => {
  const clearSessionStorage = (expectedToken?: string) => {
    const currentToken = localStorage.getItem('token');
    if (expectedToken && currentToken && currentToken !== expectedToken) {
      return;
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user_permission');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_login');
    delete axios.defaults.headers.common.Authorization;
  };

  try {
    const response = await axios.get(`${API_URL}/login/verifyToken`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data.valid) {
      return true;
    }

    clearSessionStorage(token);
    return false;
  } catch (error) {
    clearSessionStorage(token);
    return false;
  }
};

export default verifyToken;
