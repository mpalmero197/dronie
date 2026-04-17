

## How real apps handle this

You're right — pasting an `rtsp://` URL is a power-user workflow. Here's how the major drone apps actually do it:

| App | How the feed gets in |
|---|---|
| **DJI Fly / GO 4** | Phone connects to the controller via USB. The controller has the radio link to the drone. The app reads the H.264 video stream straight off the USB port — no URL, no network. |
| **DroneDeploy / Skydio** | Their mobile SDK app on the pilot's phone captures the controller feed, then re-broadcasts it to their cloud. Office viewers just open the project — the URL is invisible plumbing. |
| **DJI FlightHub 2** | Same idea: pilot opens the DJI Pilot 2 app, taps "Livestream to Cloud," the cloud assigns a viewer link automatically. |

The pattern: **the pilot's phone is the bridge.** It already has the feed; it just needs a one-tap "share" button. No one types URLs.

## Plan: Pilot Phone Broadcast (WebRTC)

Add a "Broadcast Camera" mode that turns the pilot's phone into the streaming source. Three paths, ranked by realism for a web app:

### Path A — Phone-as-camera broadcast (recommended, ship this)
The pilot opens the Dronie web app on the phone that's plugged into their controller and taps **"Start Broadcast"** on their assigned drone. The app:
1. Calls `getUserMedia()` to grab the phone's screen or rear camera
2. Opens a WebRTC peer connection
3. Uses Supabase Realtime as the **signaling channel** (offer/answer/ICE exchange via a `drone_signals` table)
4. Office viewers on `/jobs` automatically receive the stream — no URL needed

For DJI controllers with HDMI out → USB capture, the phone sees the controller feed as a webcam. For app-only setups, the pilot mirrors the DJI Fly app via screen share.

### Path B — QR pairing for hardware encoders
For teams with dedicated encoders (e.g. an Accsoon or LiveU box), generate a QR code from the drone card. Scan it on the encoder's config page → the encoder POSTs its stream endpoint back to us. Pilot never copies a URL.

### Path C — Upload demo clip
For testing/demos without hardware, let admins upload an MP4 to Supabase Storage and use it as the "live" feed. Useful for screenshots and sales demos.

## What gets built

**Database** (one new migration)
- `drone_signals` table: `drone_id`, `from_peer`, `to_peer`, `payload jsonb`, `created_at` — ephemeral WebRTC offer/answer/ICE messages, RLS scoped to authenticated users, realtime enabled
- Add `stream_mode` column to `drones`: `'webrtc' | 'url' | 'upload' | 'none'` (default `'none'`)
- Add `stream_demo_path` column for Path C uploads

**New files**
- `src/lib/webrtcBroadcast.ts` — encapsulates `startBroadcast(droneId)` and `joinBroadcast(droneId)` using Supabase Realtime for signaling
- `src/components/fleet/BroadcastButton.tsx` — big "Start Broadcast" button shown to the pilot assigned to a drone, with camera/mic permissions flow and "Stop" state
- `src/components/fleet/StreamSourcePicker.tsx` — replaces the raw URL input in `AddDroneDialog` with three tiles: **Phone Broadcast** / **Stream URL (advanced)** / **Demo Upload**

**Modified files**
- `src/components/fleet/AddDroneDialog.tsx` — swap the "Stream URL" field for `StreamSourcePicker`. URL input becomes an "Advanced" disclosure
- `src/components/fleet/CameraFeed.tsx` — add a `webrtc` branch that subscribes to the drone's signaling channel and renders the incoming `MediaStream`
- `src/pages/FleetManagement.tsx` — show `BroadcastButton` on cards for drones the current user is assigned to
- `src/pages/ActiveJobs.tsx` — same broadcast button, contextual to the job

**Tech snippet** (signaling via Supabase Realtime)
```typescript
const channel = supabase.channel(`drone:${droneId}`)
  .on('broadcast', { event: 'offer' }, ({ payload }) => pc.setRemoteDescription(payload))
  .on('broadcast', { event: 'ice' }, ({ payload }) => pc.addIceCandidate(payload))
  .subscribe();
```

## What the pilot/viewer actually sees

- **Pilot (mobile):** Opens drone card → taps green "📡 Broadcast Camera" button → grants permission → status flips to "🔴 Live" → done.
- **Viewer (anywhere):** Opens `/jobs` or fleet page → live tile auto-appears in the Live Camera Feeds grid. No URL ever shown.

## Out of scope (will note as follow-ups)
- Native DJI SDK integration (requires React Native rewrite)
- Recording broadcasts to storage
- Multi-viewer TURN server for restrictive networks (Supabase signaling works P2P; we'll add a fallback note)

