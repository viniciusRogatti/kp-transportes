import L from "leaflet";
import { BsBuildingsFill } from "react-icons/bs";
import ReactDOMServer from "react-dom/server";

export const buildIcon = L.divIcon({
  className: "custom-icon",
  html: ReactDOMServer.renderToString(<BsBuildingsFill style={{ fontSize: "20px", color: "#000000" }} />),
  iconSize: [20, 20],
});
