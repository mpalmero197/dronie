

# Website Claims Audit and Gap Analysis

After reading every section of the website, here is a comprehensive list of claims made and their delivery status, followed by a plan to close the gaps.

## Claims Audit

### Hero Section
| Claim | Status |
|-------|--------|
| "Turn Drone Flights Into Precise Maps" | Marketing tagline -- OK |
| "Upload drone imagery and receive orthomosaics, 3D point clouds, DSMs, contour maps" | **Partially delivered** -- upload works, processing is simulated (edge function just sleeps and increments progress), no real output files are generated or downloadable |
| "Upload Images Free" button | Works (goes to auth) |
| "2.3M+ Maps processed" | **Fake stat** -- no real data backing this |
| "47K+ Active pilots" | **Fake stat** |
| "99.4% Accuracy rate" | **Fake stat** |
| "< 2hrs Avg. processing" | **Fake stat** (simulated processing takes ~22 seconds) |
| "3D Model Ready" / "GeoTIFF Export" badges | **Misleading** -- no actual 3D model or GeoTIFF files exist to download |

### Features Section
| Claim | Status |
|-------|--------|
| Orthomosaic Maps (GeoTIFF export) | **Not delivered** -- no actual files |
| 3D Point Clouds (LAS/LAZ) | **Not delivered** |
| DSM & DTM | **Not delivered** |
| Contour Lines (SHP, DXF, KMZ) | **Not delivered** |
| Cloud Processing | **Simulated** -- edge function fakes progress steps |
| Map Viewer (share, measure, annotate) | **Delivered** -- viewer works with drawing tools, measurements, share links, embed codes |
| Team Collaboration ("invite members, assign roles, comment") | **Not delivered** -- no invite system, no commenting |
| GDPR Compliant | Reasonable claim if using Supabase infrastructure |

### How It Works Section
| Claim | Status |
|-------|--------|
| "Fly & Upload" -- "Supports 100GB+ per upload" | Upload works but 100GB claim is untested/unlikely |
| "Cloud Processing" -- "GPU-accelerated · Typical job < 2 hours" | **Not real** -- simulated |
| "Review & Annotate" -- "Measure area · Add GCPs · Embed in any website" | **Partially delivered** -- measurements work, GCP import works, embed works |
| "Export & Deliver" -- "Download your full output package" | **Not delivered** -- no downloadable output files |

### Pricing Section
| Claim | Status |
|-------|--------|
| Free plan: "3 projects / month", "Up to 500 images" | **No enforcement** -- no limits implemented |
| Professional $49/month | **No payment system** -- no Stripe, no billing |
| Enterprise $149/month | **No payment system** |
| "Start Free Trial" | **No trial logic** |
| "Contact Sales" | Links to `sales@mapforge.io` -- **wrong brand** (should be Dronie) |
| "All plans include SSL, automated backups, and our processing SLA" | No SLA defined |
| "Compare full features →" | **Dead link** (`href="#"`) |

### Footer Section
| Claim | Status |
|-------|--------|
| All 20 footer links (Features, Pricing, Changelog, Roadmap, API Docs, Agriculture, Construction, Documentation, Blog, About, Careers, Privacy Policy, Terms of Service, Contact, etc.) | **All dead links** (`href="#"`) |
| "Trusted by 47,000+ drone pilots in 94 countries" | **Fake stat** |
| Social media buttons (X, LinkedIn, YouTube) | **Non-functional** (no URLs) |

### Brand Inconsistencies
| Location | Issue |
|----------|-------|
| Auth page mobile logo (line 88) | Says "MapForge" instead of "Dronie" |
| Auth page subtitle (line 97) | Says "Sign in to your MapForge dashboard" |
| Dashboard sidebar (line 303) | Says "MapForge" instead of "Dronie" |

---

## Implementation Plan

Given the scope, this is prioritized by what would make the biggest impact on credibility.

### Phase 1: Fix Brand + Dead Links + Fake Stats (quick wins)

**Files**: `HeroSection.tsx`, `FooterSection.tsx`, `AuthPage.tsx`, `Dashboard.tsx`, `PricingSection.tsx`

1. **Fix brand name**: Replace all "MapForge" references with "Dronie"
2. **Replace fake stats** with honest alternatives:
   - Remove hard-coded "2.3M+", "47K+", etc.
   - Replace with feature-focused badges like "Unlimited Formats", "Browser-Based", "No Install Required", "Open Standards" -- or remove stats entirely
3. **Fix footer links**:
   - Link "Features" → `#features`, "Pricing" → `#pricing`, "How It Works" → `#how-it-works`
   - Link "Sample Projects" → `/gallery`
   - Make "Privacy Policy", "Terms of Service" link to placeholder pages or remove them
   - Remove dead sections (Changelog, Roadmap, API Docs, Blog, Webinars, Careers) or mark them "Coming Soon"
   - Fix social media buttons with real URLs or remove them
4. **Fix pricing CTA**: Change `sales@mapforge.io` → `sales@dronie.com` or a real contact method
5. **Remove "Compare full features →"** dead link
6. **Remove "Trusted by 47,000+"** from footer

### Phase 2: Fix Feature Claims

**Files**: `FeaturesSection.tsx`, `HowItWorksSection.tsx`

1. **Team Collaboration**: Either remove the claim or reword to "Coming Soon" badge
2. **Cloud Processing**: Reword to be honest -- "Simulated demo processing" or implement actual processing integration
3. **"Supports 100GB+ per upload"**: Remove or reduce to realistic limit
4. **"GPU-accelerated"**: Remove unless real processing is integrated

### Phase 3: Add Output Downloads (makes the core promise work)

**Files**: `ProjectDetail.tsx`, `process-project/index.ts`

The processing simulation already marks projects as complete with output names. Add:
1. Generate sample/placeholder output files (a sample GeoTIFF, a sample PDF report) and store them in Supabase Storage
2. Add download buttons in the Outputs tab of ProjectDetail that actually serve files
3. This makes the "Export & Deliver" claim partially true

### Phase 4: Pricing Enforcement or Removal

**File**: `PricingSection.tsx`

Either:
- Add Stripe integration for paid plans, OR
- Simplify to a single "Free Beta" plan with honest limits, removing the paid tiers until payment is implemented

### Summary of Files to Modify

| File | Changes |
|------|---------|
| `src/components/HeroSection.tsx` | Remove fake stats, replace with honest value props |
| `src/components/FeaturesSection.tsx` | Add "Coming Soon" to Team Collaboration, soften processing claims |
| `src/components/HowItWorksSection.tsx` | Remove "GPU-accelerated", "100GB+" claims |
| `src/components/PricingSection.tsx` | Fix email to Dronie brand, remove dead link, consider simplifying to "Free Beta" |
| `src/components/FooterSection.tsx` | Fix all dead links, remove fake trust stat, fix social buttons |
| `src/pages/AuthPage.tsx` | Fix "MapForge" → "Dronie" (2 places) |
| `src/pages/Dashboard.tsx` | Fix "MapForge" → "Dronie" in sidebar |
| `src/pages/ProjectDetail.tsx` | Add actual download buttons for outputs (Phase 3) |

