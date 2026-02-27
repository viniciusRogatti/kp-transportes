import axios from 'axios';
import { API_URL } from '../data';

const clearLocalSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user_permission');
  localStorage.removeItem('user_name');
  localStorage.removeItem('user_login');
  delete axios.defaults.headers.common.Authorization;
};

const logoutSession = async () => {
  const token = localStorage.getItem('token');

  try {
    if (token) {
      await axios.post(
        `${API_URL}/login/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
    }
  } catch (error) {
    // Logout local sempre deve acontecer, mesmo com falha de rede/API.
  } finally {
    clearLocalSession();
  }
};

export {
  clearLocalSession,
  logoutSession,
};

