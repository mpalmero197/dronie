import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;

  const { project_id, settings, subscription_tier } = await req.json();
  if (!project_id) {
    return new Response(JSON.stringify({ error: "project_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify user owns the project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, status")
    .eq("id", project_id)
    .single();

  if (projectError || !project) {
    return new Response(JSON.stringify({ error: "Project not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (project.user_id !== userId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (project.status === "processing") {
    return new Response(JSON.stringify({ error: "Already processing" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use service role to bypass RLS for background updates
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Determine processing priority based on subscription tier and admin role
  // Check if user is admin
  const { data: roleData } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  const isAdmin = !!roleData;

  let priority = 0; // free
  if (isAdmin) priority = 99;
  else if (subscription_tier === "enterprise") priority = 20;
  else if (subscription_tier === "professional") priority = 10;

  // Mark as queued/processing with priority
  await serviceClient
    .from("projects")
    .update({ status: "processing", progress: 0, processing_priority: priority })
    .eq("id", project_id);

  // Check queue position — count projects currently processing with higher priority
  const { count: higherPriorityCount } = await serviceClient
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("status", "processing")
    .gt("processing_priority", priority)
    .neq("id", project_id);

  const queuePosition = (higherPriorityCount || 0);
  const isPriority = priority >= 10;

  const webodmUrl = Deno.env.get("WEBODM_URL");
  const webodmToken = Deno.env.get("WEBODM_TOKEN");
  const useWebODM = !!(webodmUrl && webodmToken);

  // Add a simulated queue delay for free-tier projects when there are higher-priority jobs
  const queueDelayMs = (!isPriority && queuePosition > 0) ? Math.min(queuePosition * 5000, 30000) : 0;

  // Start background processing
  EdgeRuntime.waitUntil(
    (async () => {
      if (queueDelayMs > 0) {
        console.log(`[QUEUE] Free-tier project ${project_id} delayed ${queueDelayMs}ms (${queuePosition} higher-priority jobs ahead)`);
        await sleep(queueDelayMs);
      }
      if (useWebODM) {
        await runWebODMProcessing(serviceClient, project_id, userId, webodmUrl!, webodmToken!, settings);
      } else {
        await runSimulatedProcessing(serviceClient, project_id, userId, settings);
      }
    })()
  );

  return new Response(
    JSON.stringify({
      success: true,
      message: "Processing started",
      mode: useWebODM ? "webodm" : "simulated",
      priority,
      queue_position: queuePosition,
      priority_processing: isPriority,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

/* ────── Helper: update progress ────── */
async function updateProgress(client: ReturnType<typeof createClient>, projectId: string, progress: number) {
  await client.from("projects").update({ progress }).eq("id", projectId);
}

async function markFailed(client: ReturnType<typeof createClient>, projectId: string, error: string) {
  await client
    .from("projects")
    .update({ status: "failed", progress: 0, outputs: [], outputs_urls: { error } })
    .eq("id", projectId);
}

/* ────── Extract EXIF GPS from JPEG bytes ────── */
function extractExifGPS(bytes: Uint8Array): { lat: number; lng: number; alt: number | null; camera: string | null; date: string | null } | null {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // Check JPEG SOI
    if (view.getUint16(0) !== 0xFFD8) return null;

    let offset = 2;
    while (offset < bytes.length - 4) {
      const marker = view.getUint16(offset);
      if (marker === 0xFFE1) {
        // APP1 - EXIF
        const length = view.getUint16(offset + 2);
        const exifData = bytes.slice(offset + 4, offset + 2 + length);
        return parseExifBlock(exifData);
      }
      if ((marker & 0xFF00) !== 0xFF00) break;
      const segLen = view.getUint16(offset + 2);
      offset += 2 + segLen;
    }
  } catch {
    // Silently fail
  }
  return null;
}

function parseExifBlock(data: Uint8Array): { lat: number; lng: number; alt: number | null; camera: string | null; date: string | null } | null {
  // Check "Exif\0\0"
  const header = String.fromCharCode(...data.slice(0, 6));
  if (!header.startsWith("Exif")) return null;

  const tiffStart = 6;
  const view = new DataView(data.buffer, data.byteOffset + tiffStart, data.byteLength - tiffStart);
  const le = view.getUint16(0) === 0x4949; // Little endian

  const getU16 = (o: number) => view.getUint16(o, le);
  const getU32 = (o: number) => view.getUint32(o, le);

  function getRational(o: number): number {
    const num = view.getUint32(o, le);
    const den = view.getUint32(o + 4, le);
    return den ? num / den : 0;
  }

  function getString(o: number, count: number): string {
    let s = "";
    for (let i = 0; i < count - 1; i++) {
      const c = view.getUint8(o + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  }

  function parseDMS(o: number): number {
    const d = getRational(o);
    const m = getRational(o + 8);
    const s = getRational(o + 16);
    return d + m / 60 + s / 3600;
  }

  let gpsIfdOffset = 0;
  let camera: string | null = null;
  let date: string | null = null;

  // Parse IFD0
  const ifd0Offset = getU32(4);
  const ifd0Count = getU16(ifd0Offset);
  for (let i = 0; i < ifd0Count; i++) {
    const entryOff = ifd0Offset + 2 + i * 12;
    const tag = getU16(entryOff);
    if (tag === 0x8825) gpsIfdOffset = getU32(entryOff + 8); // GPSInfo
    if (tag === 0x0110) { // Model
      const count = getU32(entryOff + 4);
      const valOff = count <= 4 ? entryOff + 8 : getU32(entryOff + 8);
      camera = getString(valOff, count);
    }
    if (tag === 0x0132) { // DateTime
      const count = getU32(entryOff + 4);
      const valOff = count <= 4 ? entryOff + 8 : getU32(entryOff + 8);
      date = getString(valOff, count);
    }
  }

  if (!gpsIfdOffset) return null;

  let lat = 0, lng = 0, alt: number | null = null;
  let latRef = "N", lngRef = "E";

  const gpsCount = getU16(gpsIfdOffset);
  for (let i = 0; i < gpsCount; i++) {
    const entryOff = gpsIfdOffset + 2 + i * 12;
    const tag = getU16(entryOff);
    const valOff = getU32(entryOff + 8);

    if (tag === 1) latRef = String.fromCharCode(view.getUint8(entryOff + 8));
    if (tag === 2) lat = parseDMS(valOff);
    if (tag === 3) lngRef = String.fromCharCode(view.getUint8(entryOff + 8));
    if (tag === 4) lng = parseDMS(valOff);
    if (tag === 6) alt = getRational(valOff);
  }

  if (lat === 0 && lng === 0) return null;
  if (latRef === "S") lat = -lat;
  if (lngRef === "W") lng = -lng;

  return { lat, lng, alt, camera, date };
}

/* ────── Generate Flight Report PDF (minimal, text-based) ────── */
function generateReportPDF(
  projectId: string,
  imageCount: number,
  gpsPoints: Array<{ lat: number; lng: number; alt: number | null; camera: string | null; date: string | null }>,
  areaHa: number,
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): Uint8Array {
  const now = new Date().toISOString().split("T")[0];
  const cameras = [...new Set(gpsPoints.map((p) => p.camera).filter(Boolean))];
  const dates = [...new Set(gpsPoints.map((p) => p.date).filter(Boolean))].sort();
  const avgAlt = gpsPoints.filter((p) => p.alt != null).reduce((s, p) => s + (p.alt || 0), 0) / (gpsPoints.filter((p) => p.alt != null).length || 1);

  // Build a simple PDF manually (no library needed for basic text)
  const lines = [
    `FLIGHT REPORT`,
    `Generated: ${now}`,
    `Project ID: ${projectId}`,
    ``,
    `SUMMARY`,
    `-------`,
    `Total Images: ${imageCount}`,
    `Images with GPS: ${gpsPoints.length}`,
    `Estimated Area: ${areaHa.toFixed(2)} hectares`,
    `Camera(s): ${cameras.length > 0 ? cameras.join(", ") : "Unknown"}`,
    `Flight Date(s): ${dates.length > 0 ? dates.join(", ") : "Unknown"}`,
    `Average Altitude: ${avgAlt > 0 ? avgAlt.toFixed(1) + " m" : "Unknown"}`,
    ``,
    `BOUNDING BOX`,
    `------------`,
    `NW: ${bbox.maxLat.toFixed(6)}, ${bbox.minLng.toFixed(6)}`,
    `SE: ${bbox.minLat.toFixed(6)}, ${bbox.maxLng.toFixed(6)}`,
    ``,
    `GPS COORDINATES`,
    `---------------`,
    ...gpsPoints.slice(0, 50).map(
      (p, i) => `  ${String(i + 1).padStart(3)}. ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}${p.alt != null ? ` @ ${p.alt.toFixed(1)}m` : ""}`
    ),
    gpsPoints.length > 50 ? `  ... and ${gpsPoints.length - 50} more` : "",
    ``,
    `PROCESSING OUTPUTS`,
    `------------------`,
    `- Orthomosaic (GeoTIFF)`,
    `- Contours (GeoJSON)`,
    `- Digital Surface Model`,
    `- Flight Report (this file)`,
  ];

  const content = lines.join("\n");

  // Create a minimal valid PDF
  const textLines = content.split("\n");
  const pageHeight = 842; // A4
  const pageWidth = 595;
  const margin = 50;
  const lineHeight = 14;
  const maxLinesPerPage = Math.floor((pageHeight - 2 * margin) / lineHeight);

  const pages: string[][] = [];
  for (let i = 0; i < textLines.length; i += maxLinesPerPage) {
    pages.push(textLines.slice(i, i + maxLinesPerPage));
  }

  let pdf = "%PDF-1.4\n";
  const objects: string[] = [];

  // Object 1: Catalog
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");

  // Object 2: Pages (will be filled after we know page count)
  const pageObjStart = 3;
  const pageIds = pages.map((_, i) => `${pageObjStart + i * 2} 0 R`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageIds.join(" ")}] /Count ${pages.length} >>\nendobj`);

  // Font object
  const fontObjId = pageObjStart + pages.length * 2;
  
  let nextId = 3;
  for (const pageLines of pages) {
    const pageObjId = nextId++;
    const contentObjId = nextId++;

    // Build content stream
    let stream = `BT\n/F1 10 Tf\n${margin} ${pageHeight - margin} Td\n`;
    for (const line of pageLines) {
      const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      stream += `(${escaped}) Tj\n0 -${lineHeight} Td\n`;
    }
    stream += "ET";

    objects.push(
      `${contentObjId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`
    );
    objects.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 ${fontObjId} 0 R >> >> >>\nendobj`
    );
  }

  // Font object
  objects.push(`${fontObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj`);

  // Rebuild with proper cross-reference
  // Simple approach: just concatenate
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj + "\n";
  }
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (const off of offsets) {
    body += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(body);
}

/* ────── Generate Contours GeoJSON ────── */
function generateContoursGeoJSON(
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  intervalM: number = 1
): string {
  const features: any[] = [];
  const latRange = bbox.maxLat - bbox.minLat;
  const lngRange = bbox.maxLng - bbox.minLng;

  // Generate sample contour lines across the bbox
  const numContours = Math.min(20, Math.max(5, Math.floor(100 / intervalM)));
  const baseElevation = 100 + Math.random() * 200;

  for (let i = 0; i < numContours; i++) {
    const elevation = baseElevation + i * intervalM;
    const t = i / numContours;
    const points: [number, number][] = [];
    const segments = 10 + Math.floor(Math.random() * 5);

    for (let j = 0; j <= segments; j++) {
      const frac = j / segments;
      const lat = bbox.minLat + (t * 0.8 + 0.1) * latRange + Math.sin(frac * Math.PI * 2) * latRange * 0.03;
      const lng = bbox.minLng + frac * lngRange;
      points.push([lng, lat]);
    }

    features.push({
      type: "Feature",
      properties: { elevation: Math.round(elevation * 10) / 10, index: i },
      geometry: { type: "LineString", coordinates: points },
    });
  }

  return JSON.stringify(
    { type: "FeatureCollection", features },
    null,
    2
  );
}

/* ────── Generate sample DSM (simple ASCII grid) ────── */
function generateSampleDSM(
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): string {
  const cols = 50;
  const rows = 50;
  const cellsize = Math.max(
    (bbox.maxLng - bbox.minLng) / cols,
    (bbox.maxLat - bbox.minLat) / rows
  );
  const baseElev = 100 + Math.random() * 200;

  let asc = `ncols ${cols}\n`;
  asc += `nrows ${rows}\n`;
  asc += `xllcorner ${bbox.minLng}\n`;
  asc += `yllcorner ${bbox.minLat}\n`;
  asc += `cellsize ${cellsize}\n`;
  asc += `NODATA_value -9999\n`;

  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      const elev = baseElev + Math.sin(r * 0.3) * 5 + Math.cos(c * 0.2) * 3 + Math.random() * 2;
      row.push(Math.round(elev * 100) / 100);
    }
    asc += row.join(" ") + "\n";
  }
  return asc;
}

/* ────── SIMULATED PROCESSING ────── */
async function runSimulatedProcessing(
  serviceClient: ReturnType<typeof createClient>,
  projectId: string,
  userId: string,
  settings: any
) {
  try {
    // Step 1: Image alignment — list and parse images
    await updateProgress(serviceClient, projectId, 5);

    const { data: imageFiles } = await serviceClient.storage
      .from("drone-images")
      .list(`${userId}/${projectId}`, { limit: 500 });

    const validImages = (imageFiles || []).filter(
      (f) => !f.name.startsWith(".") && /\.(jpg|jpeg|tiff|tif|png|dng)$/i.test(f.name)
    );

    await updateProgress(serviceClient, projectId, 10);

    // Extract EXIF from images (up to 50 for speed)
    const gpsPoints: Array<{ lat: number; lng: number; alt: number | null; camera: string | null; date: string | null }> = [];

    const imagesToParse = validImages.slice(0, 50);
    for (let i = 0; i < imagesToParse.length; i++) {
      try {
        const { data: fileData } = await serviceClient.storage
          .from("drone-images")
          .download(`${userId}/${projectId}/${imagesToParse[i].name}`);

        if (fileData) {
          const bytes = new Uint8Array(await fileData.arrayBuffer());
          const gps = extractExifGPS(bytes);
          if (gps) gpsPoints.push(gps);
        }
      } catch {
        // Skip files that fail
      }

      // Update progress during alignment phase (5-20%)
      const alignProg = 10 + Math.floor((i / imagesToParse.length) * 10);
      await updateProgress(serviceClient, projectId, alignProg);
    }

    await updateProgress(serviceClient, projectId, 20);
    await sleep(1000);

    // Calculate bounding box
    let bbox = { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
    if (gpsPoints.length > 0) {
      bbox = {
        minLat: Math.min(...gpsPoints.map((p) => p.lat)),
        maxLat: Math.max(...gpsPoints.map((p) => p.lat)),
        minLng: Math.min(...gpsPoints.map((p) => p.lng)),
        maxLng: Math.max(...gpsPoints.map((p) => p.lng)),
      };
    } else {
      // Default bbox if no GPS data
      bbox = { minLat: 34.05, maxLat: 34.06, minLng: -118.25, maxLng: -118.24 };
    }

    // Calculate area in hectares
    const latDist = (bbox.maxLat - bbox.minLat) * 111320;
    const lngDist = (bbox.maxLng - bbox.minLng) * 111320 * Math.cos((bbox.minLat + bbox.maxLat) / 2 * Math.PI / 180);
    const areaHa = Math.max(0.1, (latDist * lngDist) / 10000);

    // Step 2: Dense point cloud
    await updateProgress(serviceClient, projectId, 42);
    await sleep(2000);

    // Step 3: Mesh generation
    await updateProgress(serviceClient, projectId, 58);
    await sleep(2000);

    // Step 4: Orthomosaic — generate placeholder
    await updateProgress(serviceClient, projectId, 65);

    // We generate a small PNG as orthomosaic placeholder
    // (A real one would be a massive GeoTIFF)
    const orthoPlaceholder = generateOrthomosaicPlaceholder(gpsPoints.length);
    const orthoPath = `${userId}/${projectId}/orthomosaic.png`;
    await serviceClient.storage.from("project-outputs").upload(orthoPath, orthoPlaceholder, {
      contentType: "image/png",
      upsert: true,
    });

    await updateProgress(serviceClient, projectId, 74);
    await sleep(1000);

    // Step 5: DSM/DTM
    const dsmContent = generateSampleDSM(bbox);
    const dsmPath = `${userId}/${projectId}/dsm.asc`;
    await serviceClient.storage.from("project-outputs").upload(dsmPath, new TextEncoder().encode(dsmContent), {
      contentType: "text/plain",
      upsert: true,
    });

    const dtmPath = `${userId}/${projectId}/dtm.asc`;
    await serviceClient.storage.from("project-outputs").upload(dtmPath, new TextEncoder().encode(dsmContent), {
      contentType: "text/plain",
      upsert: true,
    });

    await updateProgress(serviceClient, projectId, 88);
    await sleep(1500);

    // Step 6: Contour extraction
    const contourInterval = settings?.contourInterval || 1;
    const contoursGeoJSON = generateContoursGeoJSON(bbox, contourInterval);
    const contoursPath = `${userId}/${projectId}/contours.geojson`;
    await serviceClient.storage.from("project-outputs").upload(contoursPath, new TextEncoder().encode(contoursGeoJSON), {
      contentType: "application/geo+json",
      upsert: true,
    });

    await updateProgress(serviceClient, projectId, 95);
    await sleep(1000);

    // Step 7: Final export — generate report PDF
    const reportPDF = generateReportPDF(projectId, validImages.length, gpsPoints, areaHa, bbox);
    const reportPath = `${userId}/${projectId}/flight_report.pdf`;
    await serviceClient.storage.from("project-outputs").upload(reportPath, reportPDF, {
      contentType: "application/pdf",
      upsert: true,
    });

    // Get public URLs
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const baseUrl = `${supabaseUrl}/storage/v1/object/public/project-outputs`;

    const outputsUrls: Record<string, string> = {
      orthomosaic: `${baseUrl}/${orthoPath}`,
      dsm: `${baseUrl}/${dsmPath}`,
      dtm: `${baseUrl}/${dtmPath}`,
      contours: `${baseUrl}/${contoursPath}`,
      report: `${baseUrl}/${reportPath}`,
    };

    await serviceClient
      .from("projects")
      .update({
        status: "complete",
        progress: 100,
        area_ha: parseFloat(areaHa.toFixed(1)),
        outputs: ["Orthomosaic", "DSM", "DTM", "Contours GeoJSON", "Flight Report PDF"],
        outputs_urls: outputsUrls,
      })
      .eq("id", projectId);
  } catch (err: any) {
    console.error("Simulated processing failed:", err);
    await markFailed(serviceClient, projectId, err.message || "Processing failed");
  }
}

/* ────── Generate a tiny placeholder PNG ────── */
function generateOrthomosaicPlaceholder(imageCount: number): Uint8Array {
  // Generate a minimal 1x1 green PNG as placeholder
  // In reality this would be a composite of the drone images
  const png = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0x10, 0x65, 0x60, 0x00,
    0x00, 0x00, 0x06, 0x00, 0x03, 0x36, 0x37, 0x7C,
    0xA8, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
    0x44, 0xAE, 0x42, 0x60, 0x82,
  ]);
  return png;
}

/* ────── WEBODM PROCESSING ────── */
async function runWebODMProcessing(
  serviceClient: ReturnType<typeof createClient>,
  projectId: string,
  userId: string,
  webodmUrl: string,
  webodmToken: string,
  settings: any
) {
  try {
    const apiBase = webodmUrl.replace(/\/+$/, "");
    const headers = { Authorization: `JWT ${webodmToken}` };

    // Step 1: Create project in WebODM
    await updateProgress(serviceClient, projectId, 5);

    const projRes = await fetch(`${apiBase}/api/projects/`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `dronie-${projectId}` }),
    });
    if (!projRes.ok) throw new Error(`WebODM project creation failed: ${projRes.status}`);
    const webodmProject = await projRes.json();
    const webodmProjectId = webodmProject.id;

    // Step 2: Download images and upload to WebODM task
    await updateProgress(serviceClient, projectId, 10);

    const { data: imageFiles } = await serviceClient.storage
      .from("drone-images")
      .list(`${userId}/${projectId}`, { limit: 500 });

    const validImages = (imageFiles || []).filter(
      (f) => !f.name.startsWith(".") && /\.(jpg|jpeg|tiff|tif|png|dng)$/i.test(f.name)
    );

    if (validImages.length === 0) throw new Error("No images found for processing");

    // Build multipart form with images
    const formData = new FormData();

    // Add WebODM processing options
    const options: any[] = [];
    if (settings?.quality === "low") options.push({ name: "feature-quality", value: "low" });
    else if (settings?.quality === "ultra") options.push({ name: "feature-quality", value: "ultra" });
    else if (settings?.quality === "high") options.push({ name: "feature-quality", value: "high" });
    if (settings?.dsmEnabled) options.push({ name: "dsm", value: true });
    if (settings?.dtmEnabled) options.push({ name: "dtm", value: true });
    if (settings?.meshType === "none") options.push({ name: "mesh-size", value: 0 });

    formData.append("options", JSON.stringify(options));

    // Download and attach each image
    for (let i = 0; i < validImages.length; i++) {
      const { data: fileData } = await serviceClient.storage
        .from("drone-images")
        .download(`${userId}/${projectId}/${validImages[i].name}`);
      if (fileData) {
        formData.append("images", fileData, validImages[i].name);
      }
      const uploadProg = 10 + Math.floor((i / validImages.length) * 10);
      await updateProgress(serviceClient, projectId, uploadProg);
    }

    await updateProgress(serviceClient, projectId, 20);

    // Create task
    const taskRes = await fetch(`${apiBase}/api/projects/${webodmProjectId}/tasks/`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!taskRes.ok) throw new Error(`WebODM task creation failed: ${taskRes.status}`);
    const task = await taskRes.json();
    const taskId = task.id;

    // Step 3: Poll for completion
    const progressMap: Record<number, number> = {
      10: 30, 20: 42, 30: 50, 40: 58, 50: 65, 60: 74, 70: 80, 80: 88, 90: 95,
    };

    let complete = false;
    let attempts = 0;
    const maxAttempts = 720; // 2 hours at 10s intervals

    while (!complete && attempts < maxAttempts) {
      await sleep(10000);
      attempts++;

      const statusRes = await fetch(`${apiBase}/api/projects/${webodmProjectId}/tasks/${taskId}/`, { headers });
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();

      const webodmStatus = statusData.status;
      const webodmProgress = statusData.running_progress || 0;

      // Map WebODM progress to our pipeline steps
      const roundedProg = Math.floor(webodmProgress / 10) * 10;
      const mappedProg = progressMap[roundedProg] || Math.min(95, 20 + webodmProgress * 0.75);
      await updateProgress(serviceClient, projectId, Math.floor(mappedProg));

      if (webodmStatus === 40) { // COMPLETED
        complete = true;
      } else if (webodmStatus === 30) { // FAILED
        throw new Error("WebODM processing failed: " + (statusData.last_error || "Unknown error"));
      } else if (webodmStatus === 50) { // CANCELED
        throw new Error("WebODM processing was canceled");
      }
    }

    if (!complete) throw new Error("WebODM processing timed out");

    // Step 4: Download results
    await updateProgress(serviceClient, projectId, 96);

    const outputsUrls: Record<string, string> = {};
    const outputs: string[] = [];
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const baseUrl = `${supabaseUrl}/storage/v1/object/public/project-outputs`;

    const assets = [
      { name: "orthophoto.tif", key: "orthomosaic", label: "Orthomosaic" },
      { name: "all.zip", key: "all_assets", label: "All Assets (ZIP)" },
    ];

    for (const asset of assets) {
      try {
        const dlRes = await fetch(
          `${apiBase}/api/projects/${webodmProjectId}/tasks/${taskId}/download/${asset.name}`,
          { headers }
        );
        if (dlRes.ok) {
          const blob = await dlRes.blob();
          const path = `${userId}/${projectId}/${asset.name}`;
          await serviceClient.storage.from("project-outputs").upload(path, blob, {
            contentType: dlRes.headers.get("content-type") || "application/octet-stream",
            upsert: true,
          });
          outputsUrls[asset.key] = `${baseUrl}/${path}`;
          outputs.push(asset.label);
        }
      } catch {
        // Some assets may not exist depending on settings
      }
    }

    // Also try to download DSM/DTM
    for (const dem of ["dsm.tif", "dtm.tif"]) {
      try {
        const dlRes = await fetch(
          `${apiBase}/api/projects/${webodmProjectId}/tasks/${taskId}/download/${dem}`,
          { headers }
        );
        if (dlRes.ok) {
          const blob = await dlRes.blob();
          const path = `${userId}/${projectId}/${dem}`;
          await serviceClient.storage.from("project-outputs").upload(path, blob, {
            contentType: "image/tiff",
            upsert: true,
          });
          const key = dem.replace(".tif", "");
          outputsUrls[key] = `${baseUrl}/${path}`;
          outputs.push(key.toUpperCase());
        }
      } catch {}
    }

    // Calculate area from images
    const { data: imageFilesForArea } = await serviceClient.storage
      .from("drone-images")
      .list(`${userId}/${projectId}`, { limit: 5 });
    let areaHa = 0;
    // Simple estimate based on image count
    areaHa = validImages.length * 0.5;

    await serviceClient
      .from("projects")
      .update({
        status: "complete",
        progress: 100,
        area_ha: parseFloat(areaHa.toFixed(1)),
        outputs,
        outputs_urls: outputsUrls,
      })
      .eq("id", projectId);
  } catch (err: any) {
    console.error("WebODM processing failed:", err);
    await markFailed(serviceClient, projectId, err.message || "WebODM processing failed");
  }
}
