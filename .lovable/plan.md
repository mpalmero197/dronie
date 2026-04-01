

## Verifying the Simulated Processing Pipeline

This is a manual verification task — you need to test the end-to-end flow in the live preview. Here are the exact steps:

### Steps to Test

1. **Sign in** at `/auth` (create an account if needed)
2. **Create a project** from the Dashboard — give it any name
3. **Navigate to the project detail page** (`/project/:id`)
4. **Upload drone images** — drag JPEG files into the "Drone Images" upload area
   - For best results, use real drone photos with GPS EXIF data (the pipeline extracts coordinates)
   - Any JPEGs will work for the basic flow; GPS-tagged ones will produce meaningful contours/DSM
5. **Click "Start Processing"** — watch the 7 pipeline steps animate through:
   - Image Alignment → Dense Point Cloud → Mesh → Orthomosaic → DSM/DTM → Contours → Final Export
6. **Wait for completion** (~10-15 seconds in simulated mode)
7. **Verify outputs** — once status is "complete", the Outputs section should list downloadable files:
   - Orthomosaic (PNG)
   - DSM / DTM (ASC)
   - Contours (GeoJSON)
   - Flight Report (PDF)
8. **Click download links** to confirm each file downloads successfully

### What the Pipeline Generates

| Output | Format | Content |
|--------|--------|---------|
| Orthomosaic | PNG | 1×1 placeholder image |
| DSM / DTM | ASCII Grid (.asc) | 50×50 elevation grid based on GPS bbox |
| Contours | GeoJSON | 5-20 contour lines across the bbox |
| Flight Report | PDF | Text report with GPS coords, area, camera info |

### Known Limitations

- Without WebODM configured, all outputs are simulated/sample data
- The orthomosaic is a 1×1 pixel placeholder PNG (not a real composite)
- Free-tier projects may have a brief queue delay if other projects are processing

Would you like me to implement this test, or shall I proceed with something else?

