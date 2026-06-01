import { useEffect, useMemo, useState } from "react";
import {
  Power, PlaneTakeoff, PlaneLanding, Home, AlertOctagon, Hand,
  Camera, Video, VideoOff, Lightbulb, Megaphone, ShieldAlert,
  Compass, Maximize2, Layers, Send, Loader2, Activity,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { sendDroneCommand } from "@/lib/droneCommands";
import type {
  Drone, DroneCommand, DroneCommandName, FlightMode, PayloadType,
} from "@/lib/fleet-types";
import DroneStatusBadge from "./DroneStatusBadge";

interface Props {
  drone: Drone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FLIGHT_MODES: FlightMode[] = [
  "manual", "gps", "sport", "cinematic", "tripod",
  "waypoint", "orbit", "follow", "mapping", "rtk_survey", "hover",
];

const PAYLOADS: PayloadType[] = [
  "rgb", "thermal", "multispectral", "lidar", "rgb_thermal",
  "zoom", "spotlight", "speaker", "sprayer", "cargo",
];

export default function DroneControlConsole({ drone, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState<DroneCommand[]>([]);
  const [gimbalPitch, setGimbalPitch] = useState(0);
  const [gimbalYaw, setGimbalYaw] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [maxAlt, setMaxAlt] = useState(120);
  const [geofence, setGeofence] = useState(500);
  const [ttsMsg, setTtsMsg] = useState("");

  // Sync local sliders with drone telemetry whenever a new drone is opened
  useEffect(() => {
    if (!drone) return;
    setGimbalPitch(Number(drone.gimbal_pitch ?? 0));
    setGimbalYaw(Number(drone.gimbal_yaw ?? 0));
    setZoom(Number(drone.zoom_level ?? 1));
    setMaxAlt(Number(drone.max_altitude_m ?? 120));
    setGeofence(Number(drone.geofence_radius_m ?? 500));
  }, [drone?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load + subscribe to command history for this drone
  useEffect(() => {
    if (!drone || !open) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("drone_commands")
        .select("*")
        .eq("drone_id", drone.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (active) setHistory((data ?? []) as unknown as DroneCommand[]);
    })();
    const channel = supabase
      .channel(`drone-console:${drone.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "drone_commands",
        filter: `drone_id=eq.${drone.id}`,
      }, (payload) => {
        setHistory((prev) => {
          if (payload.eventType === "INSERT") return [payload.new as DroneCommand, ...prev].slice(0, 30);
          if (payload.eventType === "UPDATE")
            return prev.map((c) => c.id === (payload.new as DroneCommand).id ? payload.new as DroneCommand : c);
          return prev;
        });
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [drone?.id, open]);

  if (!drone) return null;

  const issue = async (command: DroneCommandName, params: Record<string, unknown> = {}, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(command);
    try {
      await sendDroneCommand(drone.id, command, params);
      toast({ title: "Command queued", description: command.replace(/_/g, " ") });
    } catch (err: any) {
      toast({ title: "Command failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const armed = !!drone.is_armed;
  const lowBat = drone.battery_level < 20;
  const linkOk = (drone.link_quality ?? 0) > 30 && (drone.signal_strength ?? 0) > 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{drone.name}</span>
            <DroneStatusBadge status={drone.status} />
            {armed && <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/40 border">ARMED</Badge>}
            {drone.recording && <Badge className="bg-destructive/15 text-destructive border-destructive/40 border animate-pulse">REC</Badge>}
            {!linkOk && <Badge variant="outline" className="text-destructive border-destructive/40">Weak link</Badge>}
            {lowBat && <Badge variant="outline" className="text-destructive border-destructive/40">Low battery</Badge>}
          </DialogTitle>
          <DialogDescription>
            {drone.model} · {drone.serial_number || "no S/N"} · {drone.firmware_version ?? "fw unknown"}
          </DialogDescription>
        </DialogHeader>

        {/* HUD strip */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-center">
          <Hud label="Bat" value={`${drone.battery_level}%`} accent={lowBat} />
          <Hud label="RC Bat" value={`${drone.rc_battery_level ?? "—"}%`} />
          <Hud label="Alt" value={`${drone.altitude.toFixed(0)} m`} />
          <Hud label="Spd" value={`${drone.speed.toFixed(1)} m/s`} />
          <Hud label="Hdg" value={`${drone.heading.toFixed(0)}°`} />
          <Hud label="Sats" value={`${drone.gps_satellites ?? 0}`} />
          <Hud label="Sig" value={`${drone.signal_strength ?? 0}%`} />
          <Hud label="Wind" value={`${(drone.wind_speed ?? 0).toFixed(0)} m/s`} />
        </div>

        <Tabs defaultValue="flight" className="mt-2">
          <TabsList className="grid w-full grid-cols-5 h-9">
            <TabsTrigger value="flight" className="text-xs">Flight</TabsTrigger>
            <TabsTrigger value="payload" className="text-xs">Payload</TabsTrigger>
            <TabsTrigger value="mission" className="text-xs">Mission</TabsTrigger>
            <TabsTrigger value="safety" className="text-xs">Safety</TabsTrigger>
            <TabsTrigger value="log" className="text-xs">Log</TabsTrigger>
          </TabsList>

          {/* FLIGHT */}
          <TabsContent value="flight" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <CmdBtn icon={Power} label={armed ? "Disarm" : "Arm"}
                onClick={() => issue(armed ? "disarm" : "arm", {}, armed ? undefined : "Arm motors? Props will spin.")}
                busy={busy === "arm" || busy === "disarm"}
                variant={armed ? "destructive" : "default"} />
              <CmdBtn icon={PlaneTakeoff} label="Takeoff" onClick={() => issue("takeoff", { altitude: 10 })} busy={busy === "takeoff"} />
              <CmdBtn icon={PlaneLanding} label="Land" onClick={() => issue("land")} busy={busy === "land"} />
              <CmdBtn icon={Home} label="RTH" onClick={() => issue("rth")} busy={busy === "rth"} />
              <CmdBtn icon={Hand} label="Hover" onClick={() => issue("hover")} busy={busy === "hover"} />
              <CmdBtn icon={AlertOctagon} label="E-Stop"
                variant="destructive"
                onClick={() => issue("emergency_stop", {}, "Trigger EMERGENCY STOP? Motors cut immediately.")}
                busy={busy === "emergency_stop"} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1"><Layers className="w-3 h-3" /> Flight mode</Label>
              <Select
                value={drone.flight_mode ?? "manual"}
                onValueChange={(v) => issue("set_flight_mode", { mode: v as FlightMode })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FLIGHT_MODES.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <SliderRow icon={Compass} label="Gimbal pitch" min={-90} max={30} step={1}
              value={gimbalPitch} onChange={setGimbalPitch}
              onCommit={(v) => issue("gimbal_pitch", { degrees: v })} unit="°" />
            <SliderRow icon={Compass} label="Gimbal yaw" min={-180} max={180} step={1}
              value={gimbalYaw} onChange={setGimbalYaw}
              onCommit={(v) => issue("gimbal_yaw", { degrees: v })} unit="°" />
            <SliderRow icon={Maximize2} label="Zoom" min={1} max={28} step={0.5}
              value={zoom} onChange={setZoom}
              onCommit={(v) => issue("zoom", { level: v })} unit="x" />
          </TabsContent>

          {/* PAYLOAD */}
          <TabsContent value="payload" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <CmdBtn icon={Camera} label="Photo" onClick={() => issue("capture_photo")} busy={busy === "capture_photo"} />
              {drone.recording
                ? <CmdBtn icon={VideoOff} label="Stop rec" variant="destructive" onClick={() => issue("stop_recording")} busy={busy === "stop_recording"} />
                : <CmdBtn icon={Video} label="Record" onClick={() => issue("start_recording")} busy={busy === "start_recording"} />}
            </div>

            <div>
              <Label className="text-xs">Payload</Label>
              <Select
                value={drone.payload_type ?? "rgb"}
                onValueChange={(v) => issue("switch_payload", { payload: v as PayloadType })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYLOADS.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {drone.has_spotlight && (
                <CmdBtn icon={Lightbulb} label="Spotlight"
                  onClick={() => issue("spotlight_on")} busy={busy === "spotlight_on"} />
              )}
              {drone.has_speaker && (
                <div className="col-span-2 flex gap-2">
                  <Input placeholder="Speaker TTS message…" value={ttsMsg} onChange={(e) => setTtsMsg(e.target.value)} />
                  <Button size="sm" disabled={!ttsMsg.trim() || busy === "speaker_tts"}
                    onClick={() => { issue("speaker_tts", { text: ttsMsg }); setTtsMsg(""); }}
                    className="gap-1.5"><Megaphone className="w-3.5 h-3.5" /> Speak</Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* MISSION */}
          <TabsContent value="mission" className="space-y-2 mt-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <CmdBtn icon={Send} label="Upload" onClick={() => issue("mission_upload")} busy={busy === "mission_upload"} />
              <CmdBtn icon={PlaneTakeoff} label="Start" onClick={() => issue("mission_start")} busy={busy === "mission_start"} />
              <CmdBtn icon={Hand} label="Pause" onClick={() => issue("mission_pause")} busy={busy === "mission_pause"} />
              <CmdBtn icon={PlaneTakeoff} label="Resume" onClick={() => issue("mission_resume")} busy={busy === "mission_resume"} />
              <CmdBtn icon={AlertOctagon} label="Abort" variant="destructive"
                onClick={() => issue("mission_abort", {}, "Abort active mission?")} busy={busy === "mission_abort"} />
              <CmdBtn icon={Home} label="Set Home" onClick={() => issue("set_home")} busy={busy === "set_home"} />
            </div>
          </TabsContent>

          {/* SAFETY */}
          <TabsContent value="safety" className="space-y-3 mt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Max altitude (m)</Label>
              <div className="flex gap-2">
                <Input type="number" value={maxAlt} onChange={(e) => setMaxAlt(Number(e.target.value))} />
                <Button size="sm" onClick={() => issue("set_max_altitude", { meters: maxAlt })}>Apply</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Geofence radius (m)</Label>
              <div className="flex gap-2">
                <Input type="number" value={geofence} onChange={(e) => setGeofence(Number(e.target.value))} />
                <Button size="sm" onClick={() => issue("set_geofence", { radius_m: geofence })}>Apply</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CmdBtn icon={Compass} label="Calibrate compass" onClick={() => issue("calibrate_compass")} busy={busy === "calibrate_compass"} />
              <CmdBtn icon={Activity} label="Calibrate IMU" onClick={() => issue("calibrate_imu")} busy={busy === "calibrate_imu"} />
              {drone.has_parachute && (
                <CmdBtn icon={ShieldAlert} label="Parachute" variant="destructive"
                  onClick={() => issue("parachute_deploy", {}, "Deploy parachute? This is a one-shot action.")}
                  busy={busy === "parachute_deploy"} />
              )}
            </div>
          </TabsContent>

          {/* LOG */}
          <TabsContent value="log" className="mt-3">
            <ScrollArea className="h-80 rounded-lg border border-border">
              <ul className="divide-y divide-border">
                {history.length === 0 && (
                  <li className="p-4 text-xs text-muted-foreground italic">No commands yet.</li>
                )}
                {history.map((c) => (
                  <li key={c.id} className="p-2.5 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-foreground truncate">{c.command}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleTimeString()} · {Object.keys(c.params ?? {}).length > 0 ? JSON.stringify(c.params) : "no params"}
                      </p>
                    </div>
                    <StatusPill status={c.status} />
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Hud({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border px-1.5 py-1 ${accent ? "border-destructive/40 bg-destructive/10" : "border-border bg-secondary/30"}`}>
      <p className="text-[8px] uppercase font-semibold text-muted-foreground tracking-wide">{label}</p>
      <p className={`text-[11px] font-semibold mt-0.5 truncate ${accent ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function CmdBtn({
  icon: Icon, label, onClick, busy, variant = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; onClick: () => void; busy?: boolean;
  variant?: "default" | "destructive" | "outline";
}) {
  return (
    <Button size="sm" variant={variant} onClick={onClick} disabled={busy}
      className="gap-1.5 h-9 justify-start">
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      <span className="text-xs">{label}</span>
    </Button>
  );
}

function SliderRow({
  icon: Icon, label, min, max, step, value, onChange, onCommit, unit,
}: {
  icon: React.ComponentType<{ className?: string }>; label: string;
  min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; onCommit: (v: number) => void; unit: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</Label>
        <span className="text-xs font-mono text-foreground">{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]}
        onValueChange={(v) => onChange(v[0])}
        onValueCommit={(v) => onCommit(v[0])} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: "bg-secondary text-muted-foreground",
    sent: "bg-sky-500/15 text-sky-500",
    acked: "bg-emerald-500/15 text-emerald-500",
    failed: "bg-destructive/15 text-destructive",
    cancelled: "bg-muted text-muted-foreground",
  };
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${map[status] ?? map.queued}`}>{status}</span>;
}