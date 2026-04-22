/**
 * Generic flight-plan exporters: KML, GeoJSON, CSV waypoints.
 * KMZ (DJI) lives in generateDJIFlyKMZ.ts.
 */

export interface BasicExportOpts {
  waypoints: [number, number][]; // [lat, lng]
  altitude: number;              // meters AGL
  speed: number;                 // m/s
  heading: number;               // degrees
  name?: string;
  homePosition?: [number, number] | null;
  polygon?: [number, number][];  // optional survey area outline
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  } as Record<string, string>)[c]);
}

/** Standard KML 2.2 with waypoints + flight path + optional home + polygon. */
export function generateKML(opts: BasicExportOpts): Blob {
  const { waypoints, altitude, name = "Flight Plan", homePosition, polygon } = opts;

  const placemarks = waypoints.map((wp, i) => `
    <Placemark>
      <name>WP${i + 1}</name>
      <styleUrl>#wpStyle</styleUrl>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${wp[1]},${wp[0]},${altitude}</coordinates>
      </Point>
    </Placemark>`).join("");

  const pathCoords = waypoints
    .map(wp => `${wp[1]},${wp[0]},${altitude}`).join(" ");

  const polyKml = polygon && polygon.length >= 3 ? `
    <Placemark>
      <name>Survey Area</name>
      <styleUrl>#areaStyle</styleUrl>
      <Polygon>
        <outerBoundaryIs><LinearRing><coordinates>
          ${[...polygon, polygon[0]].map(p => `${p[1]},${p[0]},0`).join(" ")}
        </coordinates></LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>` : "";

  const homeKml = homePosition ? `
    <Placemark>
      <name>Home</name>
      <styleUrl>#homeStyle</styleUrl>
      <Point><coordinates>${homePosition[1]},${homePosition[0]},0</coordinates></Point>
    </Placemark>` : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(name)}</name>
    <Style id="wpStyle">
      <IconStyle><color>ff0a93f5</color><scale>0.9</scale></IconStyle>
    </Style>
    <Style id="homeStyle">
      <IconStyle><color>ff22c55e</color><scale>1.1</scale></IconStyle>
    </Style>
    <Style id="pathStyle">
      <LineStyle><color>ff0aa3f5</color><width>3</width></LineStyle>
    </Style>
    <Style id="areaStyle">
      <LineStyle><color>ff63a3eb</color><width>2</width></LineStyle>
      <PolyStyle><color>3363a3eb</color></PolyStyle>
    </Style>
    ${polyKml}
    ${homeKml}
    <Placemark>
      <name>Flight Path</name>
      <styleUrl>#pathStyle</styleUrl>
      <LineString>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${pathCoords}</coordinates>
      </LineString>
    </Placemark>
    ${placemarks}
  </Document>
</kml>`;

  return new Blob([xml], { type: "application/vnd.google-earth.kml+xml" });
}

/** GeoJSON FeatureCollection with waypoints, path, polygon, home. */
export function generateGeoJSON(opts: BasicExportOpts): Blob {
  const { waypoints, altitude, speed, heading, name = "Flight Plan", homePosition, polygon } = opts;

  const features: any[] = [];

  if (polygon && polygon.length >= 3) {
    features.push({
      type: "Feature",
      properties: { kind: "survey_area", name: "Survey Area" },
      geometry: {
        type: "Polygon",
        coordinates: [[...polygon, polygon[0]].map(p => [p[1], p[0]])],
      },
    });
  }

  features.push({
    type: "Feature",
    properties: { kind: "flight_path", altitude, speed, heading },
    geometry: {
      type: "LineString",
      coordinates: waypoints.map(wp => [wp[1], wp[0], altitude]),
    },
  });

  if (homePosition) {
    features.push({
      type: "Feature",
      properties: { kind: "home", name: "Home" },
      geometry: { type: "Point", coordinates: [homePosition[1], homePosition[0], 0] },
    });
  }

  waypoints.forEach((wp, i) => {
    features.push({
      type: "Feature",
      properties: { kind: "waypoint", index: i + 1, altitude, speed, heading },
      geometry: { type: "Point", coordinates: [wp[1], wp[0], altitude] },
    });
  });

  const fc = {
    type: "FeatureCollection",
    name,
    features,
  };

  return new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
}

/** Simple CSV waypoint list: index,lat,lng,alt_m,speed_mps,heading_deg */
export function generateWaypointCSV(opts: BasicExportOpts): Blob {
  const { waypoints, altitude, speed, heading } = opts;
  const rows = ["index,latitude,longitude,altitude_m,speed_mps,heading_deg"];
  waypoints.forEach((wp, i) => {
    rows.push(`${i + 1},${wp[0].toFixed(7)},${wp[1].toFixed(7)},${altitude.toFixed(1)},${speed.toFixed(1)},${heading.toFixed(0)}`);
  });
  return new Blob([rows.join("\n")], { type: "text/csv" });
}

/** Trigger a browser download for any Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}