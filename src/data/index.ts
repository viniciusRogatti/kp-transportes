import { IMapLocation } from "../types/types";

export const API_URL = (process.env.REACT_APP_API_URL || "https://kptransportes-backend.up.railway.app").replace(/\/$/, "");
export const COMPANY_LOCATION: IMapLocation = {
  id: 1,
  lat: -22.958562,
  lng: -47.096044
};
