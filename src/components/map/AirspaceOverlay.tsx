import { TileLayer } from "react-leaflet";

export default function AirspaceOverlay() {
  return (
    <TileLayer
      url="https://api.tiles.openaip.net/api/data/airspaces/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openaip.net/">OpenAIP</a>'
      opacity={0.55}
      maxZoom={14}
      zIndex={500}
    />
  );
}
