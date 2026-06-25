import GuideLayout from "./GuideLayout";

export default function DronePhotogrammetryGuide() {
  return (
    <GuideLayout
      path="/guides/drone-photogrammetry"
      title="The Complete Guide to Drone Photogrammetry (2026) | Dronie"
      description="How drone photogrammetry works end to end — flight planning, capture, processing, and deliverables like orthomosaics, DSM/DTM, point clouds, and 3D models. Written for working pilots and surveyors."
      h1="The complete guide to drone photogrammetry"
      kicker="Foundation guide · 18 min read"
    >
      <p>
        Drone photogrammetry is the practice of flying a camera in an overlapping pattern over a site, then using
        software to triangulate the same physical point across many photos and reconstruct a 3D model of the
        scene. From that model you derive the deliverables a client actually pays for: an <strong>orthomosaic</strong>,
        a <strong>digital surface model (DSM)</strong>, a <strong>digital terrain model (DTM)</strong>,
        a <strong>dense point cloud</strong>, contours, volumes, and increasingly a <strong>3D mesh</strong> or{" "}
        <strong>Gaussian splat</strong> for visualization.
      </p>
      <p>
        This guide walks the full pipeline — sensor selection, mission planning, GSD math, capture, processing,
        QA, and delivery — with the trade-offs that matter when you're billing for the result.
      </p>

      <h2>1. What "photogrammetry" really means</h2>
      <p>
        Photogrammetry is measurement from photographs. Given two or more images of the same point taken from
        different positions, you can solve for that point's 3D coordinates — exactly the same parallax math your
        eyes use to perceive depth. Modern Structure-from-Motion (SfM) pipelines automate this for thousands of
        photos at once: they detect features, match them across images, solve camera poses, and then build a dense
        cloud and mesh.
      </p>
      <p>
        Compared with LiDAR, photogrammetry is cheaper, captures color natively, and works with any reasonable
        drone camera. It struggles with reflective surfaces, dense vegetation (the camera can't see through
        canopy), and uniform textures like fresh snow.
      </p>

      <h2>2. The full pipeline</h2>
      <ol>
        <li><strong>Plan.</strong> Define area, target GSD, overlap, altitude, and ground control plan.</li>
        <li><strong>Fly.</strong> Capture a structured grid (and oblique passes for verticals) at constant altitude or terrain-following.</li>
        <li><strong>Pre-process.</strong> Cull blurry frames, verify EXIF GPS, place markers on ground control points (GCPs).</li>
        <li><strong>Process.</strong> SfM alignment → dense cloud → mesh → DSM → orthomosaic → DTM → contours.</li>
        <li><strong>QA.</strong> Check accuracy against checkpoints, inspect for holes, doming, or seamlines.</li>
        <li><strong>Deliver.</strong> Export GeoTIFFs, LAS/LAZ, DXF, OBJ — plus an interactive web viewer the client can actually open.</li>
      </ol>

      <h2>3. Sensors and platforms</h2>
      <p>
        A 1" sensor at 20 MP (DJI Mavic 3 Enterprise, Air 3) is the modern baseline for mapping. Larger sensors
        (Phase One, full-frame mirrorless on a heavy lift) give better low-light performance and cleaner pixels,
        which translates to less noise in the point cloud. For survey-grade accuracy you want{" "}
        <strong>RTK or PPK</strong> on the airframe, which timestamps each shutter against a corrected GNSS base
        and removes the need for dense ground control.
      </p>
      <p>
        Mechanical shutters matter more than people admit. A rolling shutter on a fast-moving aircraft will warp
        building edges and inflate horizontal error. If you're flying linear corridors (powerlines, highways,
        pipelines), get a global or mechanical shutter.
      </p>

      <h2>4. GSD: the number that drives every other decision</h2>
      <p>
        Ground Sample Distance is the real-world size of one pixel on the ground. It's a function of sensor pitch,
        focal length, and flight altitude:
      </p>
      <pre><code>GSD (cm/px) = (sensor width in cm × altitude in m × 100) / (focal length in mm × image width in px)</code></pre>
      <p>
        A useful rule of thumb: your <strong>achievable horizontal accuracy is roughly 1–3 × GSD</strong> with good
        ground control, and your <strong>vertical accuracy is 2–4 × GSD</strong>. So if a client needs
        ±2 cm vertical, you're flying at a GSD of about 0.5–1 cm/px. Read our{" "}
        <a href="/guides/gsd-ground-sample-distance">full GSD guide</a> for worked examples.
      </p>

      <h2>5. Overlap, altitude, and flight pattern</h2>
      <p>
        Standard mapping overlap is <strong>75% front / 65% side</strong>. For tall structures, vegetation, or
        anything you'll feed into a 3D mesh, bump to <strong>85/75 with a cross-grid and 45° obliques</strong>.
        Higher overlap costs flight time but is the single biggest factor in suppressing doming, holes, and
        misalignment.
      </p>
      <p>
        Fly at constant altitude over flat sites; switch to <strong>terrain-following</strong> over hilly terrain so
        GSD and overlap stay constant. Most modern planners (Dronie's included) read a DEM and modulate altitude
        per waypoint.
      </p>

      <h2>6. Ground control: GCPs, checkpoints, and RTK/PPK</h2>
      <p>
        Four to eight well-distributed GCPs at the corners and one in the middle of the site will lock
        absolute accuracy for most jobs. Add separate <strong>checkpoints</strong> that you exclude from the
        bundle adjustment — they're how you prove accuracy in the deliverable report. With RTK/PPK you can fly
        with fewer GCPs (or none, for relative work), but a survey-grade deliverable should always include
        independent checkpoints.
      </p>

      <h2>7. Processing in the cloud vs on a workstation</h2>
      <p>
        Desktop tools like Pix4D, Metashape, and RealityCapture are excellent, but they tie up a $5–10k
        workstation for hours per job and force you to babysit the pipeline. Cloud processing — Dronie included —
        offloads the GPU-heavy stages to elastic infrastructure: you upload, the queue processes, you get a link.
        The trade-off is upload time on slow internet and, occasionally, less granular parameter control.
      </p>
      <p>
        Practical rule: if you're flying more than a few jobs a month, the cloud workflow pays for itself in
        labor saved. For one-off forensic or research work where you need every parameter tunable, keep a
        desktop license around.
      </p>

      <h2>8. Deliverables, in plain English</h2>
      <ul>
        <li><strong>Orthomosaic</strong> — a single, top-down, scale-correct image of the site. Hand to the GC, drop into CAD as a backdrop.</li>
        <li><strong>DSM</strong> — elevation including everything (trees, buildings, equipment). Use for design intersect, line-of-sight, solar.</li>
        <li><strong>DTM</strong> — elevation of the bare earth only, after vegetation and structures are filtered out. Use for grading and earthworks.</li>
        <li><strong>Point cloud</strong> — the raw 3D measurement. LAS/LAZ for handoff to surveyors; the input to most other derivatives.</li>
        <li><strong>3D mesh</strong> — textured triangle mesh for visualization, walkthroughs, marketing.</li>
        <li><strong>Gaussian splat</strong> — a newer 3D representation that renders photo-real in a browser. See the <a href="/guides/gaussian-splatting">splats guide</a>.</li>
      </ul>
      <p>
        The orthomosaic/DSM/DTM/point-cloud quartet covers 95% of paid work. Our{" "}
        <a href="/guides/orthomosaic-dsm-dtm">deliverables comparison</a> goes deeper on which one to send when.
      </p>

      <h2>9. Quality assurance before you invoice</h2>
      <ul>
        <li>Check the report's reprojection error — under 1 px is good, under 0.5 is excellent.</li>
        <li>Inspect checkpoint RMSE; compare it to what you quoted.</li>
        <li>Pan the orthomosaic at 100% and look for seamlines, ghosting, or missing tiles.</li>
        <li>Slice the DSM in QGIS or the cloud viewer — any doming or saddling means you need more cross-grid.</li>
        <li>Confirm the CRS in the GeoTIFF header matches what the client requested.</li>
      </ul>

      <h2>10. Compliance and airspace</h2>
      <p>
        In the U.S., every paid drone flight falls under <strong>FAA Part 107</strong>. Most commercial mapping
        jobs require a <strong>LAANC authorization</strong> if any portion of the site is in controlled airspace.
        Our <a href="/guides/part-107-laanc">Part 107 &amp; LAANC checklist</a> walks the exact pre-flight workflow.
      </p>

      <h2>Frequently asked questions</h2>
      <h3>Do I need RTK to deliver survey-grade?</h3>
      <p>
        No — well-placed GCPs with a survey-grade GNSS rover will get you the same horizontal accuracy. RTK saves
        ground time and is essential on sites where you can't physically place targets (steep slopes, active
        construction, dense industrial).
      </p>
      <h3>How long does processing take?</h3>
      <p>
        On Dronie's cloud, a 500-image acre-scale job typically finishes in 20–45 minutes. A 5,000-image
        corridor job runs 4–8 hours. Local processing on a high-end workstation runs roughly 2–4× longer
        wall-clock and pegs the machine the whole time.
      </p>
      <h3>Can photogrammetry replace LiDAR?</h3>
      <p>
        For open-ground topography, often yes. For anything under canopy (forestry, archaeology, transmission
        corridor ground-class), LiDAR still wins because photons can't reach the ground through leaves.
      </p>
    </GuideLayout>
  );
}