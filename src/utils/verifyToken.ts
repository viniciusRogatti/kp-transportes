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
    return false;
  } catch (error) {
    localStorage.removeItem('token');
    return false;
  }
};

export default verifyToken;