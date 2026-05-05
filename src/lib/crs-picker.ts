/**
 * Curated CRS list for drone surveying. Includes:
 *  - UTM zones auto-suggested from GPS centroid
 *  - Common US State Plane zones
 *  - Web Mercator / WGS-84 fallbacks
 */
export interface CrsOption {
  code: string;        // EPSG code as "EPSG:1234"
  label: string;
  region?: string;
  units: "m" | "ft" | "us-ft";
}

export const COMMON_CRS: CrsOption[] = [
  { code: "EPSG:4326",  label: "WGS 84 (lat/lng)",      region: "Global",          units: "m" },
  { code: "EPSG:3857",  label: "Web Mercator",          region: "Global",          units: "m" },
  // US State Plane (most-used by surveyors)
  { code: "EPSG:2227",  label: "NAD83 California III (US ft)",       region: "US-CA",  units: "us-ft" },
  { code: "EPSG:2230",  label: "NAD83 California VI (US ft)",        region: "US-CA",  units: "us-ft" },
  { code: "EPSG:2240",  label: "NAD83 Georgia West (US ft)",         region: "US-GA",  units: "us-ft" },
  { code: "EPSG:2249",  label: "NAD83 Massachusetts Mainland (US ft)", region: "US-MA", units: "us-ft" },
  { code: "EPSG:2272",  label: "NAD83 Pennsylvania South (US ft)",   region: "US-PA",  units: "us-ft" },
  { code: "EPSG:2278",  label: "NAD83 Texas Central (US ft)",        region: "US-TX",  units: "us-ft" },
  { code: "EPSG:2868",  label: "NAD83(HARN) Arizona Central (ft)",   region: "US-AZ",  units: "ft" },
  // Common European
  { code: "EPSG:25832", label: "ETRS89 / UTM 32N",  region: "Western Europe",  units: "m" },
  { code: "EPSG:25833", label: "ETRS89 / UTM 33N",  region: "Central Europe",  units: "m" },
  { code: "EPSG:27700", label: "OSGB 1936 / British National Grid", region: "UK",  units: "m" },
];

/** Compute the UTM zone EPSG for WGS-84 from a lat/lng. */
export function suggestUtmEpsg(lat: number, lng: number): CrsOption | null {
  if (!isFinite(lat) || !isFinite(lng)) return null;
  const zone = Math.floor((lng + 180) / 6) + 1;
  const north = lat >= 0;
  const code = north ? 32600 + zone : 32700 + zone;
  return {
    code: `EPSG:${code}`,
    label: `WGS 84 / UTM ${zone}${north ? "N" : "S"}`,
    region: "Auto-detected from GPS centroid",
    units: "m",
  };
}
