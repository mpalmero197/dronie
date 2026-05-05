import { Rocket, Cloud, Layers3, Download, Ruler, Share2, Sprout, Map, HardHat } from "lucide-react";

export default function PhotogrammetryGuideSection() {
  return (
    <section id="photogrammetry-guide" className="py-24 bg-background border-y border-border">
      <div className="container mx-auto px-6 max-w-5xl space-y-20">
        {/* TL;DR / Definition */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Drone photogrammetry software
          </span>
          <h2 className="mt-3 text-4xl font-display font-700 text-foreground leading-tight">
            Fast drone photogrammetry software for 3D mapping &amp; modeling
          </h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Drone photogrammetry</strong> is
            the science of turning overlapping aerial photographs into
            measurable 2D maps and 3D models. Dronieapp is a high-speed,
            cloud-based drone photogrammetry software that converts raw
            imagery into accurate orthomosaics, point clouds, and textured
            meshes — typically <strong className="text-foreground">3–5× faster</strong> than
            desktop tools like Pix4D, Agisoft Metashape, DroneDeploy, or
            Maps Made Easy. Surveyors, civil engineers, and construction
            managers use it to deliver GeoTIFF, LAS/LAZ, and OBJ outputs in
            under an hour for a typical 500-image dataset.
          </p>

          <div className="mt-6 grid sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-card border border-border">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Cloud vs. desktop</p>
              <p className="mt-1 text-sm text-foreground leading-relaxed">
                Desktop photogrammetry is bottlenecked by your GPU and RAM.
                Dronieapp dispatches every job to a fleet of high-memory
                cloud workers, so a 1,200-image survey that takes 6+ hours
                in Metashape finishes in roughly <strong>45–90 minutes</strong> on Dronieapp.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Why it matters</p>
              <p className="mt-1 text-sm text-foreground leading-relaxed">
                Faster turnarounds mean same-day deliverables for clients,
                weekly progress maps for construction sites, and true
                near-real-time digital twins for infrastructure monitoring.
              </p>
            </div>
          </div>
        </div>

        {/* HowTo: 4 Steps */}
        <div>
          <h2 className="text-3xl font-display font-700 text-foreground">
            How to create 3D maps with Dronieapp (4 steps)
          </h2>
          <ol className="mt-8 space-y-6">
            {[
              {
                icon: Rocket,
                n: "1",
                t: "Plan and execute the drone flight",
                d: "Use Dronieapp's terrain-aware flight planner to set 75% front overlap and 65% side overlap at a constant ground sampling distance (GSD). Higher overlap means denser tie points and a sharper orthomosaic. The planner exports to DJI Fly KMZ, Litchi CSV, and UgCS so any DJI, Autel, Parrot, or senseFly UAV can fly the mission autonomously.",
              },
              {
                icon: Cloud,
                n: "2",
                t: "Upload to the cloud and auto-stitch",
                d: "Drag JPEG, TIFF, or DNG files into the project. The pipeline auto-detects EXIF GPS, RTK/PPK corrections, and camera calibration, then runs Structure-from-Motion (SfM) and Multi-View Stereo (MVS) without any manual tuning. Watch live progress on the project page.",
              },
              {
                icon: Layers3,
                n: "3",
                t: "Refine the 3D point cloud and mesh",
                d: "Trim noisy edges, classify ground vs. non-ground points, drop ground control points (GCPs) for sub-centimeter accuracy, and regenerate the mesh in one click. Densification, decimation, and texture re-baking all run server-side.",
              },
              {
                icon: Download,
                n: "4",
                t: "Export precise GIS and CAD data",
                d: "Download GeoTIFF orthomosaics, LAS/LAZ point clouds, GeoTIFF DSM/DTM rasters, SHP/DXF/KMZ contour lines, OBJ/FBX textured meshes, and .ply/.splat/.ksplat Gaussian splats. Outputs open natively in ArcGIS, QGIS, AutoCAD, Civil 3D, Revit, and CloudCompare.",
              },
            ].map(({ icon: Icon, n, t, d }) => (
              <li key={n} className="flex gap-4 p-5 rounded-2xl bg-card border border-border">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 font-display font-700">
                  {n}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <h3 className="font-display font-600 text-foreground text-lg">{t}</h3>
                  </div>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Key features */}
        <div>
          <h2 className="text-3xl font-display font-700 text-foreground">
            Key features of fast photogrammetry software
          </h2>
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {[
              { icon: Map, t: "High-resolution orthomosaic generation", d: "Sub-2 cm GSD GeoTIFF orthomosaics with EPSG-aware projection. Ground control points push horizontal accuracy to under 1 cm RMSE." },
              { icon: Ruler, t: "Volumetric measurements & analysis", d: "Calculate stockpile volume, cut-and-fill, area, distance, and elevation profiles directly in the browser viewer — no plugin required." },
              { icon: Share2, t: "Cross-platform sharing", d: "Every project gets a shareable link and an embeddable iframe viewer. Teammates and clients open it on any device — no download." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="p-5 rounded-2xl bg-card border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="mt-3 font-display font-600 text-foreground">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Speed comparison table */}
        <div>
          <h2 className="text-3xl font-display font-700 text-foreground">
            Why processing speed matters in drone surveying
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            On active construction and infrastructure sites, the value of a
            map decays by the hour. Faster photogrammetry means tighter
            project lead times, fewer reflights, and the ability to
            maintain a true <strong className="text-foreground">digital twin</strong> that
            mirrors site conditions weekly instead of monthly.
          </p>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-foreground">
                <tr>
                  <th className="text-left p-4 font-semibold">Dataset</th>
                  <th className="text-left p-4 font-semibold">Desktop (Pix4D / Metashape)</th>
                  <th className="text-left p-4 font-semibold">Dronieapp cloud</th>
                  <th className="text-left p-4 font-semibold">Speedup</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["250 images · 12 acres", "~90 min", "~18 min", "5×"],
                  ["500 images · 40 acres", "~3.5 hr", "~45 min", "4.6×"],
                  ["1,200 images · 110 acres", "~8 hr", "~90 min", "5.3×"],
                  ["3,000 images · 250 acres", "~22 hr", "~4 hr", "5.5×"],
                ].map((row) => (
                  <tr key={row[0]} className="border-t border-border">
                    {row.map((c, i) => (
                      <td key={i} className={`p-4 ${i === 3 ? "text-primary font-semibold" : ""}`}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Benchmarks based on a 24 MP RGB camera at 75/65% overlap, run on
            a Ryzen 9 / RTX 4080 desktop vs. Dronieapp's standard cloud
            queue.
          </p>
        </div>

        {/* Industry use cases */}
        <div>
          <h2 className="text-3xl font-display font-700 text-foreground">
            Industry use cases for Dronieapp
          </h2>
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {[
              {
                icon: Sprout,
                t: "Precision agriculture & crop health",
                d: "Generate NDVI and RGB orthomosaics from multispectral cameras like the MicaSense RedEdge or DJI Mavic 3M. Identify crop stress, irrigation issues, and yield zones across thousands of acres weekly.",
              },
              {
                icon: Map,
                t: "Land surveying & topographic mapping",
                d: "Produce contour maps, DTMs, and boundary overlays at survey-grade accuracy with RTK/PPK and GCP support. Export DXF and SHP straight into Civil 3D, Carlson, or TBC.",
              },
              {
                icon: HardHat,
                t: "Infrastructure inspection & safety",
                d: "Build dimensionally accurate 3D meshes of bridges, cell towers, transmission lines, and rooftops. Inspectors flag defects in the browser viewer and export annotated PDF reports for clients.",
              },
            ].map(({ icon: Icon, t, d }) => (
              <article key={t} className="p-5 rounded-2xl bg-card border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="mt-3 font-display font-600 text-foreground">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{d}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
