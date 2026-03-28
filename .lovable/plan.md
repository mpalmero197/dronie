

# Real Photogrammetry Processing with WebODM + Simulated Fallback

## Overview

Replace the current sleep-based simulation with a dual-mode processing pipeline:
1. **WebODM mode** — when a WebODM API URL and token are configured, submit tasks to a real WebODM/NodeODM instance for actual photogrammetry (orthomosaics, point clouds, DSM/DTM)
2. **Simulated mode** — when no WebODM is configured, generate real downloadable output files (PDF report, sample GeoTIFF, contour GeoJSON) from uploaded image EXIF metadata

## Architecture

```text
┌─────────────┐     POST /process-project
│  Frontend   │ ──────────────────────────►┌──────────────────────┐
│ ProjectDetail│                           │  process-project     │
└─────────────┘                            │  (edge function)     │
                                           │                      │
                                           │  Has WEBODM_URL?     │
                                           │   ├─ YES → WebODM    │
                                           │   │   POST /task/new  │
                                           │   │   poll status     │
                                           │   │   download assets │
                                           │   │   store in bucket │
                                           │   └─ NO → Simulate   │
                                           │       extract EXIF   │
                                           │       gen PDF report  │
                                           │       gen GeoJSON     │
                                           │       store in bucket │
                                           └──────────────────────┘
```

## Plan

### 1. Create `project-outputs` storage bucket
- New public bucket for generated/downloaded output files
- RLS policies: users read own project outputs, service role writes
- Path pattern: `{user_id}/{project_id}/{filename}`

### 2. Add `outputs_urls` column to `projects` table
- JSONB column to store a map of output name → storage path (e.g., `{"orthomosaic": "uid/pid/ortho.tif", "report": "uid/pid/report.pdf"}`)
- This replaces the current text array `outputs` with actionable download paths

### 3. Rewrite `process-project` edge function — simulated mode
When `WEBODM_URL` is not set:
- List uploaded images from `drone-images` bucket for the project
- Extract EXIF GPS coordinates and camera metadata from images (using a lightweight EXIF parser)
- Generate a **Flight Report PDF** with: image locations plotted, camera info, estimated coverage area, timestamp summary
- Generate a **contours GeoJSON** file from the image GPS bounding box (sample elevation contours)
- Generate a **sample orthomosaic placeholder** (a simple GeoTIFF-like file or composite thumbnail)
- Upload all generated files to `project-outputs` bucket
- Update `projects.outputs_urls` with download paths
- Still update progress in steps so the UI pipeline animation works

### 4. Rewrite `process-project` edge function — WebODM mode
When `WEBODM_URL` and `WEBODM_TOKEN` secrets are set:
- Download images from `drone-images` bucket
- POST to WebODM `/api/projects` then `/api/projects/{id}/tasks` with the images
- Poll task status every 10s, mapping WebODM progress to the 7 pipeline steps
- On completion, download orthomosaic, point cloud, DSM/DTM from WebODM
- Upload results to `project-outputs` bucket
- Update `projects.outputs_urls`
- On failure, set project status to `failed` with error message

### 5. Update `ProjectDetail.tsx` — downloadable outputs
- Replace the "Demo" badges on output files with actual **Download** buttons
- Each output links to a signed URL from the `project-outputs` bucket
- Remove the "demo mode" warning banner when real outputs exist
- Keep the banner only when `outputs_urls` is empty/null

### 6. Secret management
- Use the `add_secret` tool to let the user optionally provide `WEBODM_URL` and `WEBODM_TOKEN`
- The edge function checks for these at runtime and chooses the appropriate mode
- No secrets needed for simulated mode

## Technical Details

- **EXIF parsing in Deno**: Use `npm:exif-parser` or `npm:exifreader` via esm.sh to extract GPS coords and camera model from JPEG files
- **PDF generation in edge function**: Use `npm:jspdf` (already a project dependency) to create the flight report
- **WebODM API**: Standard NodeODM REST API — `POST /task/new` with multipart form, `GET /task/{id}/info` for status, `GET /task/{id}/download/{asset}` for results
- **Edge function timeout**: WebODM processing can take minutes/hours, so we use `EdgeRuntime.waitUntil()` with polling loops (already established pattern)
- **Fallback detection**: Simple `Deno.env.get("WEBODM_URL")` check at the start of `runProcessing`

