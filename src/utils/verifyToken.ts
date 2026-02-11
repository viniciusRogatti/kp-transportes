import axios from "axios";
import { API_URL } from "../data";

const verifyToken = async (token: string) => {
  try {
    const response = await axios.get(`${API_URL}/login/verifyToken`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data.valid) {
      return true;
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user_permission');
    return false;
  } catch (error) {
    localStorage.removeItem('token');
    localStorage.removeItem('user_permission');
    return false;
  }
};

export default verifyToken;
