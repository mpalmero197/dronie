/**
 * Flight path generation algorithms for different survey modes.
 */

const SENSOR_WIDTH = 13.2;
const SENSOR_HEIGHT = 8.8;
const FOCAL_LENGTH = 8.8;
const IMAGE_WIDTH = 5472;

function toRad(d: number) { return (d * Math.PI) / 180; }

export function haversineDistance(p1: [number, number], p2: [number, number]): number {
  const R = 6371000;
  const dLat = toRad(p2[0] - p1[0]);
  const dLng = toRad(p2[1] - p1[1]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p1[0])) * Math.cos(toRad(p2[0])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function polygonArea(pts: [number, number][]): number {
  if (pts.length < 3) return 0;
  const R = 6371000;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += toRad(pts[j][1] - pts[i][1]) * (2 + Math.sin(toRad(pts[i][0])) + Math.sin(toRad(pts[j][0])));
  }
  return Math.abs((area * R * R) / 2);
}

function rotatePoint(p: [number, number], center: [number, number], angleDeg: number): [number, number] {
  const a = toRad(angleDeg);
  const dx = p[1] - center[1];
  const dy = p[0] - center[0];
  return [
    center[0] + dy * Math.cos(a) - dx * Math.sin(a),
    center[1] + dy * Math.sin(a) + dx * Math.cos(a),
  ];
}

function clipLineToPolygon(y: number, _xMin: number, _xMax: number, poly: [number, number][]): [number, number][][] {
  const intersections: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const p1 = poly[i], p2 = poly[j];
    if ((p1[0] <= y && p2[0] > y) || (p2[0] <= y && p1[0] > y)) {
      const x = p1[1] + ((y - p1[0]) / (p2[0] - p1[0])) * (p2[1] - p1[1]);
      intersections.push(x);
    }
  }
  intersections.sort((a, b) => a - b);
  const segments: [number, number][][] = [];
  for (let i = 0; i < intersections.length - 1; i += 2) {
    segments.push([[y, intersections[i]], [y, intersections[i + 1]]]);
  }
  return segments;
}

/** Standard lawnmower / grid survey path */
export function generateLawnmowerPath(
  polygon: [number, number][],
  altitude: number,
  frontOverlap: number,
  sideOverlap: number,
  heading: number,
): [number, number][] {
  const gsdX = (altitude * SENSOR_WIDTH) / FOCAL_LENGTH;
  const gsdY = (altitude * SENSOR_HEIGHT) / FOCAL_LENGTH;
  const lineSpacing = gsdX * (1 - sideOverlap / 100);
  const photoSpacing = gsdY * (1 - frontOverlap / 100);

  const cx = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
  const cy = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
  const center: [number, number] = [cx, cy];

  const rotated = polygon.map(p => rotatePoint(p, center, -heading));
  const lats = rotated.map(p => p[0]);
  const lngs = rotated.map(p => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latPerMeter = 1 / 111320;
  const lineSpacingDeg = lineSpacing * latPerMeter;
  const _photoSpacingDeg = photoSpacing * (1 / (111320 * Math.cos(toRad(cx))));

  const waypoints: [number, number][] = [];
  let lineIdx = 0;
  for (let lat = minLat; lat <= maxLat; lat += lineSpacingDeg) {
    const segments = clipLineToPolygon(lat, minLng, maxLng, rotated);
    for (const seg of segments) {
      const [start, end] = lineIdx % 2 === 0 ? [seg[0], seg[1]] : [seg[1], seg[0]];
      const segLen = Math.abs(end[1] - start[1]);
      const numPoints = Math.max(2, Math.ceil(segLen / _photoSpacingDeg) + 1);
      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const pt: [number, number] = [
          start[0] + t * (end[0] - start[0]),
          start[1] + t * (end[1] - start[1]),
        ];
        waypoints.push(rotatePoint(pt, center, heading));
      }
    }
    if (segments.length > 0) lineIdx++;
  }
  return waypoints;
}

/** Perimeter / boundary flight — fly along the edges of the polygon */
export function generatePerimeterPath(
  polygon: [number, number][],
  altitude: number,
  frontOverlap: number,
  loops: number = 1,
  insetMeters: number = 0,
): [number, number][] {
  const gsdY = (altitude * SENSOR_HEIGHT) / FOCAL_LENGTH;
  const photoSpacing = gsdY * (1 - frontOverlap / 100);

  // Optionally inset the polygon
  let poly = [...polygon];
  if (insetMeters > 0) {
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    const scale = 1 - insetMeters / (haversineDistance([cx, cy], poly[0]) || 1);
    poly = poly.map(p => [
      cx + (p[0] - cx) * scale,
      cy + (p[1] - cy) * scale,
    ] as [number, number]);
  }

  const latPerMeter = 1 / 111320;
  const photoSpacingLat = photoSpacing * latPerMeter;

  const waypoints: [number, number][] = [];

  for (let loop = 0; loop < loops; loop++) {
    const closed = [...poly, poly[0]];
    for (let i = 0; i < closed.length - 1; i++) {
      const start = closed[i];
      const end = closed[i + 1];
      const dist = haversineDistance(start, end);
      const numPoints = Math.max(2, Math.ceil(dist / photoSpacing) + 1);
      for (let j = 0; j < numPoints; j++) {
        const t = j / (numPoints - 1);
        waypoints.push([
          start[0] + t * (end[0] - start[0]),
          start[1] + t * (end[1] - start[1]),
        ]);
      }
    }
  }

  return waypoints;
}

/** Orbit / POI mode — circular flight around a center point */
export function generateOrbitPath(
  center: [number, number],
  radiusMeters: number,
  altitude: number,
  numPoints: number = 36,
  loops: number = 1,
): [number, number][] {
  const latPerMeter = 1 / 111320;
  const lngPerMeter = 1 / (111320 * Math.cos(toRad(center[0])));
  const waypoints: [number, number][] = [];

  const totalPoints = numPoints * loops;
  for (let i = 0; i <= totalPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    waypoints.push([
      center[0] + radiusMeters * latPerMeter * Math.cos(angle),
      center[1] + radiusMeters * lngPerMeter * Math.sin(angle),
    ]);
  }

  return waypoints;
}

/** Corridor / linear mode — parallel flight lines along a polyline */
export function generateCorridorPath(
  line: [number, number][],
  altitude: number,
  frontOverlap: number,
  sideOverlap: number,
  corridorWidthMeters: number,
): [number, number][] {
  if (line.length < 2) return [];

  const gsdX = (altitude * SENSOR_WIDTH) / FOCAL_LENGTH;
  const gsdY = (altitude * SENSOR_HEIGHT) / FOCAL_LENGTH;
  const lineSpacing = gsdX * (1 - sideOverlap / 100);
  const photoSpacing = gsdY * (1 - frontOverlap / 100);

  const latPerMeter = 1 / 111320;
  const halfWidth = corridorWidthMeters / 2;
  const numLines = Math.max(1, Math.ceil(corridorWidthMeters / lineSpacing));

  const waypoints: [number, number][] = [];

  for (let lineIdx = 0; lineIdx < numLines; lineIdx++) {
    const offset = -halfWidth + (lineIdx + 0.5) * (corridorWidthMeters / numLines);
    const offsetLat = offset * latPerMeter;

    // Generate waypoints along the line with perpendicular offset
    const pathPoints: [number, number][] = [];

    for (let i = 0; i < line.length - 1; i++) {
      const p1 = line[i], p2 = line[i + 1];
      const dx = p2[1] - p1[1];
      const dy = p2[0] - p1[0];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      // Perpendicular direction (normalized)
      const nx = -dy / len;
      const ny = dx / len;

      const dist = haversineDistance(p1, p2);
      const numPts = Math.max(2, Math.ceil(dist / photoSpacing) + 1);

      for (let j = 0; j < numPts; j++) {
        const t = j / (numPts - 1);
        pathPoints.push([
          p1[0] + t * dy + nx * offsetLat,
          p1[1] + t * dx + ny * offsetLat,
        ]);
      }
    }

    // Alternate direction for serpentine pattern
    if (lineIdx % 2 === 1) pathPoints.reverse();
    waypoints.push(...pathPoints);
  }

  return waypoints;
}

/** GSD calculation */
export function calculateGSD(altitude: number): number {
  return (altitude * SENSOR_WIDTH) / (FOCAL_LENGTH * IMAGE_WIDTH) * 100;
}
