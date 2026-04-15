/**
 * Generate a DJI Fly-compatible waypoint KMZ file (.kmz)
 * Follows the DJI WPML (WayPoint Markup Language) specification.
 * Compatible with DJI Fly app drones: Mini 4 Pro, Air 3, Mavic 3, etc.
 *
 * KMZ structure:
 *   wpmz/template.kml   – template with waypoint definitions
 *   wpmz/waylines.wpml  – executable waylines with detailed actions
 */
import * as JSZip from "jszip";

interface DJIFlyKMZOptions {
  waypoints: [number, number][];
  altitude: number;
  speed: number;
  heading: number;
  name?: string;
  homePosition?: [number, number];
  perWpAltitudes?: number[];
}

function buildTemplateKml(opts: DJIFlyKMZOptions): string {
  const { waypoints, altitude, speed, name = "Flight Plan", perWpAltitudes } = opts;
  const altMode = perWpAltitudes ? "relativeToStartPoint" : "relativeToStartPoint";

  const placemarks = waypoints.map((wp, i) => {
    const alt = perWpAltitudes ? perWpAltitudes[i] : altitude;
    return `    <Placemark>
      <Point>
        <coordinates>${wp[1]},${wp[0]}</coordinates>
      </Point>
      <wpml:index>${i}</wpml:index>
      <wpml:executeHeight>${alt.toFixed(1)}</wpml:executeHeight>
      <wpml:waypointSpeed>${speed.toFixed(1)}</wpml:waypointSpeed>
      <wpml:waypointHeadingParam>
        <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
      </wpml:waypointHeadingParam>
      <wpml:waypointTurnParam>
        <wpml:waypointTurnMode>toPointAndStopWithDiscontinuityCurvature</wpml:waypointTurnMode>
        <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
      </wpml:waypointTurnParam>
      <wpml:useStraightLine>1</wpml:useStraightLine>
      <wpml:actionGroup>
        <wpml:actionGroupId>${i}</wpml:actionGroupId>
        <wpml:actionGroupStartIndex>${i}</wpml:actionGroupStartIndex>
        <wpml:actionGroupEndIndex>${i}</wpml:actionGroupEndIndex>
        <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
        <wpml:actionTrigger>
          <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
        </wpml:actionTrigger>
        <wpml:action>
          <wpml:actionId>0</wpml:actionId>
          <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
          <wpml:actionActuatorFuncParam>
            <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
          </wpml:actionActuatorFuncParam>
        </wpml:action>
      </wpml:actionGroup>
    </Placemark>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
<Document>
  <wpml:author>Dronie</wpml:author>
  <wpml:createTime>${Date.now()}</wpml:createTime>
  <wpml:updateTime>${Date.now()}</wpml:updateTime>
  <wpml:missionConfig>
    <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
    <wpml:finishAction>goHome</wpml:finishAction>
    <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
    <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
    <wpml:globalTransitionalSpeed>${speed.toFixed(1)}</wpml:globalTransitionalSpeed>
    <wpml:droneInfo>
      <wpml:droneEnumValue>67</wpml:droneEnumValue>
      <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
    </wpml:droneInfo>
  </wpml:missionConfig>
  <Folder>
    <wpml:templateType>waypoint</wpml:templateType>
    <wpml:templateId>0</wpml:templateId>
    <wpml:autoFlightSpeed>${speed.toFixed(1)}</wpml:autoFlightSpeed>
    <wpml:waylineCoordinateSysParam>
      <wpml:coordinateMode>WGS84</wpml:coordinateMode>
      <wpml:heightMode>${altMode}</wpml:heightMode>
    </wpml:waylineCoordinateSysParam>
    <wpml:globalHeight>${altitude.toFixed(1)}</wpml:globalHeight>
${placemarks}
  </Folder>
</Document>
</kml>`;
}

function buildWaylinesWpml(opts: DJIFlyKMZOptions): string {
  const { waypoints, altitude, speed, perWpAltitudes } = opts;
  const altMode = perWpAltitudes ? "relativeToStartPoint" : "relativeToStartPoint";

  const placemarks = waypoints.map((wp, i) => {
    const alt = perWpAltitudes ? perWpAltitudes[i] : altitude;
    return `    <Placemark>
      <Point>
        <coordinates>${wp[1]},${wp[0]}</coordinates>
      </Point>
      <wpml:index>${i}</wpml:index>
      <wpml:executeHeight>${alt.toFixed(1)}</wpml:executeHeight>
      <wpml:waypointSpeed>${speed.toFixed(1)}</wpml:waypointSpeed>
      <wpml:waypointHeadingParam>
        <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
      </wpml:waypointHeadingParam>
      <wpml:waypointTurnParam>
        <wpml:waypointTurnMode>toPointAndStopWithDiscontinuityCurvature</wpml:waypointTurnMode>
        <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
      </wpml:waypointTurnParam>
      <wpml:useStraightLine>1</wpml:useStraightLine>
      <wpml:actionGroup>
        <wpml:actionGroupId>${i}</wpml:actionGroupId>
        <wpml:actionGroupStartIndex>${i}</wpml:actionGroupStartIndex>
        <wpml:actionGroupEndIndex>${i}</wpml:actionGroupEndIndex>
        <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
        <wpml:actionTrigger>
          <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
        </wpml:actionTrigger>
        <wpml:action>
          <wpml:actionId>0</wpml:actionId>
          <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
          <wpml:actionActuatorFuncParam>
            <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
          </wpml:actionActuatorFuncParam>
        </wpml:action>
      </wpml:actionGroup>
    </Placemark>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
  <Document>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>${speed.toFixed(1)}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>67</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:autoFlightSpeed>${speed.toFixed(1)}</wpml:autoFlightSpeed>
      <wpml:waylineCoordinateSysParam>
        <wpml:coordinateMode>WGS84</wpml:coordinateMode>
        <wpml:heightMode>${altMode}</wpml:heightMode>
      </wpml:waylineCoordinateSysParam>
      <wpml:globalHeight>${altitude.toFixed(1)}</wpml:globalHeight>
${placemarks}
    </Folder>
  </Document>
</kml>`;
}

export async function generateDJIFlyKMZ(opts: DJIFlyKMZOptions): Promise<Blob> {
  const zip = new JSZip();
  const wpmz = zip.folder("wpmz")!;
  wpmz.file("template.kml", buildTemplateKml(opts));
  wpmz.file("waylines.wpml", buildWaylinesWpml(opts));
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.google-earth.kmz" });
}
