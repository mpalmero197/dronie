

# Auto-enable Airspace Overlay with LAANC Check

## What changes

When the user selects the LAANC check tool, the airspace overlay should automatically turn on so pilots can visually see airspace zones. When LAANC check is deactivated, the overlay should revert to its previous state (not force-disable it if the user had it on independently).

## Implementation

**File: `src/pages/MapViewer.tsx`** (single file change)

In the `onToolChange` handler (around line 305-312), add logic:
- When `tool === "laanc-check"`, also set `activeOverlay` to `"airspace"` if it isn't already
- Store the previous overlay state so we can restore it when LAANC is deactivated
- When switching away from `"laanc-check"`, restore the previous overlay (or `null`)

Alternatively, simpler approach: use a `useEffect` that watches `activeTool` — when it becomes `"laanc-check"`, save current overlay and set `"airspace"`; when it stops being `"laanc-check"`, restore the saved overlay.

Add a `useRef<string | null>` to track the overlay state before LAANC was activated:

```typescript
const prevOverlayRef = useRef<string | null>(null);

useEffect(() => {
  if (activeTool === "laanc-check") {
    prevOverlayRef.current = activeOverlay;
    setActiveOverlay("airspace");
  } else {
    // Only restore if airspace was auto-set
    if (activeOverlay === "airspace" && prevOverlayRef.current !== "airspace") {
      setActiveOverlay(prevOverlayRef.current);
    }
  }
}, [activeTool]);
```

This keeps it clean — one `useEffect`, no other files touched.

