

# Auto-Load Parcel Data + Drone Flight Path Planner

## Overview

Two major features: (1) click-on-map to fetch parcel boundaries from a free public API, and (2) a full drone flight path planning tool inspired by Maps Made Easy.

## 1. Auto-Load Parcel Data via Map Click

**Approach**: Use the free **OpenStreetMap Nominatim reverse geocode** + **Overpass API** to fetch building/land-use boundaries near a clicked point. For US parcels specifically, we can query the free **LOVELAND/Regrid public tile endpoint** or fall back to Overpass for