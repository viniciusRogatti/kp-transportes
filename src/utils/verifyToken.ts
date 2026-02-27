import axios from "axios";
import { API_URL } from "../data";

const verifyToken = async (token: string) => {
  const clearSessionStorage = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_permission');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_login');
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

    clearSessionStorage();
    return false;
  } catch (error) {
    clearSessionStorage();
    return false;
  }
};

export default verifyToken;
