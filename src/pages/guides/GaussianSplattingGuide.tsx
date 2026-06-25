import GuideLayout from "./GuideLayout";

export default function GaussianSplattingGuide() {
  return (
    <GuideLayout
      path="/guides/gaussian-splatting"
      title="Gaussian Splatting for Drone Capture (2026 Guide) | Dronie"
      description="What 3D Gaussian Splatting is, how it differs from photogrammetry and NeRF, the capture pattern that works for drones, and where splats win for real estate, marketing, and inspection."
      h1="Gaussian splatting for drone capture"
      kicker="3D / splats · 14 min read"
    >
      <p>
        3D Gaussian Splatting (3DGS) is the most important new 3D representation since the textured mesh. It
        renders photo-real scenes in a web browser at 60+ FPS, captures reflections and thin geometry that
        photogrammetry mangles, and trains in minutes on a single GPU. For drone pilots, it opens a whole new
        deliverable category: an interactive, navigable, photoreal 3D of the site that the client can fly through
        on their phone.
      </p>

      <h2>What a "splat" actually is</h2>
      <p>
        Forget triangles. A splat scene is a cloud of millions of small, oriented, semi-transparent 3D ellipsoids
        ("Gaussians"), each carrying a position, a covariance (its shape and orientation), an opacity, and a
        view-dependent color encoded as spherical harmonics. To render a frame, the GPU projects each Gaussian to
        screen space and alpha-blends them back-to-front. Because the primitives are soft and view-dependent,
        they reproduce specular highlights, fuzzy vegetation, and translucent surfaces that triangle meshes
        cannot.
      </p>

      <h2>Splats vs photogrammetry vs NeRF</h2>
      <table>
        <thead>
          <tr><th></th><th>Photogrammetry mesh</th><th>NeRF</th><th>Gaussian splat</th></tr>
        </thead>
        <tbody>
          <tr><td>Visual fidelity</td><td>Good on hard surfaces</td><td>Excellent</td><td>Excellent</td></tr>
          <tr><td>Reflections / glass / foliage</td><td>Poor</td><td>Good</td><td>Good</td></tr>
          <tr><td>Train time</td><td>10–60 min</td><td>Hours</td><td>5–30 min</td></tr>
          <tr><td>Render speed in browser</td><td>60+ FPS</td><td>Slow</td><td>60+ FPS</td></tr>
          <tr><td>Editable geometry</td><td>Yes</td><td>No</td><td>Limited</td></tr>
          <tr><td>Measurable</td><td>Yes (mm-cm)</td><td>No</td><td>Approx</td></tr>
          <tr><td>File size</td><td>10–500 MB</td><td>GBs</td><td>20–300 MB</td></tr>
        </tbody>
      </table>
      <p>
        The headline: splats are for <strong>looking at</strong>; meshes and point clouds are for{" "}
        <strong>measuring</strong>. The professional workflow runs both pipelines from the same image set.
      </p>

      <h2>Capture pattern for a great splat</h2>
      <p>
        Splats need <em>more views from more angles</em> than a mapping flight. The structure-from-motion solve
        still has to work, so overlap rules still apply, but you want to deliberately add view diversity:
      </p>
      <ol>
        <li><strong>Two nadir grids</strong> (front and side) at 80/70 overlap.</li>
        <li><strong>One 45° oblique orbit</strong> at the perimeter, camera pointed inward.</li>
        <li><strong>One 60° oblique orbit</strong> closer in, at half the altitude.</li>
        <li><strong>One low-altitude "hero" pass</strong> for any feature the client cares about (entry, signage, equipment).</li>
      </ol>
      <p>
        Aim for <strong>800–2,500 photos</strong> for a typical residential or small commercial site. More isn't
        always better — the training step will downsample anyway, and you pay in upload time.
      </p>

      <h2>What ruins a splat</h2>
      <ul>
        <li><strong>Moving objects</strong> in many frames — cars, pedestrians, swaying trees on a windy day. They appear as ghostly streaks.</li>
        <li><strong>Inconsistent exposure</strong> across the flight. Lock exposure manually for the orbits.</li>
        <li><strong>Sun directly behind the camera on glass.</strong> Reflections lock in and look fake.</li>
        <li><strong>Too few oblique angles.</strong> Splat artifacts ("popcorn", "spikes") happen where the scene was undersampled from that direction.</li>
      </ul>

      <h2>Where splats are winning paid work</h2>
      <ul>
        <li><strong>Luxury real estate.</strong> A browser-embedded splat tour outperforms video for time-on-page.</li>
        <li><strong>Wedding venues, resorts, event spaces.</strong> Splats reproduce string lights, water, and foliage realistically.</li>
        <li><strong>Construction marketing.</strong> Monthly splats from the same flight plan make for compelling project timelines.</li>
        <li><strong>Pre-bid walkthroughs.</strong> Trades can "walk" a site before submitting a number.</li>
        <li><strong>Inspection triage.</strong> Splats let an engineer 100 miles away pre-screen what needs a closer look.</li>
      </ul>

      <h2>Embedding splats on the open web</h2>
      <p>
        A splat scene is just a binary file (commonly <code>.splat</code>, <code>.ply</code>, or the compressed{" "}
        <code>.ksplat</code>) plus a WebGL viewer. Open-source viewers (mkkellogg's GaussianSplats3D, Babylon.js,
        antimatter15) render directly in the browser with no plugin. Dronie hosts the scene, generates a share
        token, and serves an embeddable iframe so you can drop a splat into Squarespace, Webflow, or an MLS
        listing without managing the GPU pipeline yourself.
      </p>

      <h2>What's coming next</h2>
      <p>
        Active areas of research that are already showing up in production splat pipelines: editable splats
        (move, delete, re-light primitives), splat-to-mesh extraction for CAD handoff, time-varying "4D" splats
        of moving scenes, and dramatically smaller file sizes via quantization and SH compression. Expect
        sub-50 MB residential splats by end of 2026.
      </p>

      <p>
        Splats sit alongside your existing deliverables — they don't replace them. Pair every splat with a real
        orthomosaic and point cloud; see the{" "}
        <a href="/guides/orthomosaic-dsm-dtm">deliverables breakdown</a> and the{" "}
        <a href="/guides/drone-photogrammetry">photogrammetry overview</a>.
      </p>
    </GuideLayout>
  );
}