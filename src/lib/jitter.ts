// Privacy jitter: shift a coordinate by ~5 miles (8 km) in a random direction.
// Stored once on save so the marker doesn't move on every load.
const EARTH_R_KM = 6371;

export interface JitteredPoint {
  lat: number;
  lng: number;
}

/**
 * Offset a lat/lng by a random bearing and a random distance between
 * minKm and maxKm (default ~6–10 km, roughly 4–6 miles).
 */
export function jitterCoord(lat: number, lng: number, minKm = 6, maxKm = 10): JitteredPoint {
  const distanceKm = minKm + Math.random() * (maxKm - minKm);
  const bearing = Math.random() * 2 * Math.PI;

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const angDist = distanceKm / EARTH_R_KM;

  const newLat = Math.asin(
    Math.sin(latRad) * Math.cos(angDist) +
      Math.cos(latRad) * Math.sin(angDist) * Math.cos(bearing)
  );
  const newLng =
    lngRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angDist) * Math.cos(latRad),
      Math.cos(angDist) - Math.sin(latRad) * Math.sin(newLat)
    );

  return {
    lat: +((newLat * 180) / Math.PI).toFixed(6),
    lng: +(((newLng * 180) / Math.PI + 540) % 360 - 180).toFixed(6),
  };
}
