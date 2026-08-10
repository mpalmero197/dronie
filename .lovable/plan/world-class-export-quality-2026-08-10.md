# World-class export quality

Today the processing job sends WebODM only four options (feature-quality, dsm, dtm, mesh-size) and downloads only four files. Everything else the user picks in the settings panel — target GSD, point density, mesh type, matcher, min features, output format, contours — never reaches the reconstruction engine. And when a real asset is missing, the job uploads a synthesized stand-in (a 200-point PLY, a cube OBJ) labelled as a deliverable. That is the gap between "it runs" and "world-class".

## 1. Send the full quality profile to the engine

Map every setting the UI already collects onto real WebODM/ODM options:

- **Quality tier** drives a matched set, not one flag: `feature-quality`, `pc-quality`, `depthmap-resolution`, `mesh-octree-depth`, `mesh-size`, `orthophoto-resolution` — using the values already defined in `QUALITY_PROFILE`.
- **Target GSD** becomes `orthophoto-resolution` (cm/px) and `dem-resolution`, so a 2 cm request actually produces a 2 cm ortho instead of the engine default.
- **Point density** scales `pc-quality` and `pc-filter` (outlier removal) instead of being decorative.
- **Mesh type**: 3D → `use-3dmesh` + full texturing; 2.5D → skip 3D mesh; none → `skip-3dmodel`.
- **Matcher / min features** → `matcher-type` (bow vs bruteforce) and `min-num-features`.
- **Elevation**: `dsm`, `dtm`, `dem-gapfill-steps`, `dem-euclidean-map`, and `smrf-*` ground-classification tuning for DTM accuracy.
- **Output format**: `cog` when the user picks Cloud-Optimized GeoTIFF, plus `orthophoto-compression` (DEFLATE) and `orthophoto-cutline` + `crop` so orthos have clean edges instead of smeared borders. ECW/JP2 aren't produced by the engine — the UI will say so rather than silently returning a GeoTIFF.
- **Always on for quality**: `auto-boundary`, `pc-rectify`, `texturing-skip-global-seam-leveling: false`, `radiometric-calibration: camera+sun` for the agriculture preset, and `use-exif`/GCP handling when a GCP file was uploaded.

## 2. Collect every deliverable the engine produces

Extend the download list beyond ortho + all.zip + DSM/DTM to include the point cloud (`georeferenced_model.laz`), the quality report (`report.pdf`), camera shots (`shots.geojson`, `cameras.json`), and the ortho tiles archive. Each is uploaded, labelled, and exposed on the Deliverables tab.

## 3. Stop shipping fake files

Remove the placeholder fallback for OBJ/FBX/PLY/Potree/Cesium/LandXML/CityGML in real runs. If the engine didn't produce an asset, the deliverable is recorded as unavailable with the reason logged, instead of a cube mesh labelled "OBJ Mesh (placeholder)". The simulator path keeps its samples but labels them clearly as demo data.

## 4. Real accuracy numbers

Parse the engine's report and shots data to fill the Accuracy Report with actual reprojection error, GCP residuals, and achieved GSD, rather than estimates. Write the achieved GSD, CRS, vertical datum, and processing options into `metadata.json` so downstream GIS tools and the PDF report can cite them.

## 5. Tighten the presets

Rework the presets in `src/lib/photogrammetry.ts` so each targets a defensible GSD and option set (survey-grade mapping at 2 cm, inspection at ultra + bruteforce, agriculture with radiometric calibration at 5 cm), and surface the resulting ortho/DEM resolution in the estimate panel so users see the output spec before they run.

## Technical notes

- All engine-option work lives in `supabase/functions/process-project/index.ts` (`runWebODMProcessing` and a new `buildWebodmOptions(settings)` helper covering the mapping above).
- Asset download becomes a table-driven list with per-asset content types; failures log a warning and mark the deliverable unavailable.
- Frontend changes are limited to preset definitions, the estimate panel's output-spec line, and the accuracy report reading real values.
- No database schema changes required; `outputs_urls` already stores arbitrary keys.
