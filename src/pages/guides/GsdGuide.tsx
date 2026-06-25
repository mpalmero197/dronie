import GuideLayout from "./GuideLayout";

export default function GsdGuide() {
  return (
    <GuideLayout
      path="/guides/gsd-ground-sample-distance"
      title="Ground Sample Distance (GSD) Explained — Drone Mapping Math | Dronie"
      description="How to calculate GSD from sensor pitch, focal length, and altitude. Worked examples for DJI sensors and a practical guide to picking the right GSD for the accuracy a client needs."
      h1="Ground sample distance (GSD) explained"
      kicker="Mission math · 10 min read"
    >
      <p>
        Ground Sample Distance (GSD) is the real-world width of a single pixel on the ground in your captured
        image. If your GSD is 2 cm/px, every pixel in the orthomosaic represents a 2 × 2 cm patch of the
        world. GSD is the most important number in a drone mapping mission — it sets your maximum achievable
        accuracy, your flight altitude, your flight time, and ultimately your invoice.
      </p>

      <h2>The formula</h2>
      <pre><code>{`GSD (cm/px) = (sensor width [cm] × altitude [m] × 100) / (focal length [mm] × image width [px])`}</code></pre>
      <p>
        Or, more usefully, solved for altitude:
      </p>
      <pre><code>{`Altitude [m] = (GSD [cm/px] × focal length [mm] × image width [px]) / (sensor width [cm] × 100)`}</code></pre>

      <h2>Worked example — DJI Mavic 3 Enterprise</h2>
      <p>
        Hasselblad L2D-20c, 4/3" sensor: sensor width ≈ <strong>17.3 mm</strong>, focal length{" "}
        <strong>12.29 mm</strong>, image width <strong>5280 px</strong>. To hit a GSD of <strong>1.5 cm/px</strong>:
      </p>
      <pre><code>{`Altitude = (1.5 × 12.29 × 5280) / (1.73 × 100) = 562 m`}</code></pre>
      <p>
        Of course you can't fly at 562 m in U.S. Part 107 airspace (400 ft AGL ≈ 122 m). So the real question is:{" "}
        <em>what GSD do I get at the legal ceiling?</em> Plug it in:
      </p>
      <pre><code>{`GSD at 120 m = (1.73 × 120 × 100) / (12.29 × 5280) = 0.32 cm/px`}</code></pre>
      <p>
        That's the floor for that aircraft under Part 107 — beautifully sharp.
      </p>

      <h2>What GSD do you actually need?</h2>
      <table>
        <thead>
          <tr><th>Use case</th><th>Recommended GSD</th><th>Typical altitude (35 mm equiv)</th></tr>
        </thead>
        <tbody>
          <tr><td>Roof / facade inspection (defects)</td><td>0.3–0.6 cm/px</td><td>15–30 m</td></tr>
          <tr><td>Construction progress monitoring</td><td>1.0–2.0 cm/px</td><td>40–80 m</td></tr>
          <tr><td>Site survey, volumes</td><td>1.5–3.0 cm/px</td><td>60–120 m</td></tr>
          <tr><td>Corridor mapping (utility, road)</td><td>2.0–4.0 cm/px</td><td>80–120 m</td></tr>
          <tr><td>Wide-area orthomosaic for planning</td><td>4.0–8.0 cm/px</td><td>120 m+ (waiver)</td></tr>
          <tr><td>Marketing / real estate visuals</td><td>2.0–5.0 cm/px</td><td>50–120 m</td></tr>
        </tbody>
      </table>

      <h2>GSD vs accuracy — the rules of thumb</h2>
      <ul>
        <li><strong>Horizontal accuracy:</strong> 1–3 × GSD with good ground control.</li>
        <li><strong>Vertical accuracy:</strong> 2–4 × GSD with good ground control.</li>
        <li><strong>Detectable feature size:</strong> roughly 3 × GSD (a 0.5 cm crack needs ≈ 0.15 cm GSD).</li>
      </ul>
      <p>
        So if the spec says "±2 cm horizontal, ±3 cm vertical", you're aiming for a GSD around 0.7–1 cm/px — and
        then you need to actually hit it with overlap, lighting, and ground control.
      </p>

      <h2>GSD on hilly terrain</h2>
      <p>
        GSD scales linearly with altitude above the camera-to-subject distance. If you fly a constant 100 m AGL
        plan over a hill that rises 40 m, your real flight altitude over the hilltop is 60 m and your GSD there
        is <em>40% finer</em> than at the lowlands. Photos won't match the rest of the dataset's overlap, and the
        SfM solver works harder. <strong>Use terrain following</strong> — let the planner read a DEM and modulate
        altitude so every photo is taken at the same height above the ground.
      </p>

      <h2>GSD and flight time</h2>
      <p>
        Halve the GSD → halve the altitude → roughly quarter the area each photo covers → roughly four times as
        many photos and ~4× longer flight (or more batteries) for the same site. Don't over-spec GSD without a
        reason; it's the easiest way to blow a budget.
      </p>

      <p>
        Once you've locked GSD, the rest of the mission falls out of it. Read the{" "}
        <a href="/guides/drone-photogrammetry">photogrammetry guide</a> for the full pipeline, and the{" "}
        <a href="/guides/part-107-laanc">Part 107 &amp; LAANC checklist</a> before you file the flight.
      </p>
    </GuideLayout>
  );
}