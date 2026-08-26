import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Users, Plus, X, ShieldCheck, Check, AlertTriangle, ClipboardCheck, Loader2, BadgeCheck,
} from "lucide-react";

interface Props {
  projectId: string;
  userId: string;
}

const CHECKLIST_SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Crew & authorization",
    items: [
      "RPIC identified and holds current Part 107 certificate",
      "Crew briefing completed (roles, comms, abort criteria)",
      "Visual observer(s) briefed and in position",
      "Airspace checked — LAANC authorization obtained if required",
      "NOTAMs / TFRs reviewed for the operating area",
    ],
  },
  {
    title: "Aircraft & payload",
    items: [
      "Airframe inspected — no cracks, loose arms or debris",
      "Propellers undamaged and correctly seated",
      "Batteries charged (aircraft + controller) and secured",
      "Firmware and app up to date",
      "Storage media inserted, formatted and with free space",
      "Camera / payload settings verified for the mission",
    ],
  },
  {
    title: "Site & environment",
    items: [
      "Weather within limits (wind, visibility, precipitation, temperature)",
      "Launch and landing zones clear of people and obstacles",
      "Obstacles surveyed — towers, wires, trees mapped",
      "Bystanders / non-participants controlled",
      "Emergency plan: nearest hospital, fire, and abort landing zones",
    ],
  },
  {
    title: "Final checks",
    items: [
      "GPS lock acquired (10+ satellites)",
      "Compass and IMU calibrated",
      "RTH altitude set above tallest obstacle",
      "Geofence and max altitude configured",
      "Control link quality confirmed before launch",
    ],
  },
];

const ATTITUDES: { key: string; name: string; thought: string; antidote: string }[] = [
  { key: "anti_authority", name: "Anti-Authority", thought: "\u201CDon\u2019t tell me what to do.\u201D", antidote: "Follow the rules. They are usually right." },
  { key: "impulsivity", name: "Impulsivity", thought: "\u201CDo something \u2014 quickly!\u201D", antidote: "Not so fast. Think first." },
  { key: "invulnerability", name: "Invulnerability", thought: "\u201CIt won\u2019t happen to me.\u201D", antidote: "It could happen to me." },
  { key: "macho", name: "Macho", thought: "\u201CI can do it \u2014 watch this.\u201D", antidote: "Taking chances is foolish." },
  { key: "resignation", name: "Resignation", thought: "\u201CWhat\u2019s the use?\u201D", antidote: "I\u2019m not helpless. I can make a difference." },
];

const TOTAL_ITEMS = CHECKLIST_SECTIONS.reduce((n, s) => n + s.items.length, 0);

export default function CrewResourcePanel({ projectId, userId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rpicName, setRpicName] = useState("");
  const [rpicCert, setRpicCert] = useState("");
  const [pmcName, setPmcName] = useState("");
  const [observers, setObservers] = useState<string[]>([]);
  const [observerDraft, setObserverDraft] = useState("");
  const [briefing, setBriefing] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [attitudes, setAttitudes] = useState<Record<string, boolean>>({});
  const [signedOffAt, setSignedOffAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("project_crm")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (!active) return;
      if (data) {
        setRpicName(data.rpic_name ?? "");
        setRpicCert(data.rpic_cert ?? "");
        setPmcName(data.pmc_name ?? "");
        setObservers(data.visual_observers ?? []);
        setBriefing(data.crew_briefing ?? "");
        setChecklist((data.checklist as Record<string, boolean>) ?? {});
        setAttitudes((data.hazardous_attitudes as Record<string, boolean>) ?? {});
        setSignedOffAt(data.signed_off_at);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [projectId]);

  const checkedCount = useMemo(
    () => Object.values(checklist).filter(Boolean).length,
    [checklist],
  );
  const attitudesCount = useMemo(
    () => ATTITUDES.filter((a) => attitudes[a.key]).length,
    [attitudes],
  );
  const crewReady = rpicName.trim().length > 0;
  const readyToSign = crewReady && checkedCount === TOTAL_ITEMS && attitudesCount === ATTITUDES.length;

  const save = async (extra?: { signed_off_at?: string | null }) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("project_crm").upsert(
        {
          project_id: projectId,
          user_id: userId,
          rpic_name: rpicName.trim() || null,
          rpic_cert: rpicCert.trim() || null,
          pmc_name: pmcName.trim() || null,
          visual_observers: observers,
          crew_briefing: briefing.trim() || null,
          checklist,
          hazardous_attitudes: attitudes,
          ...(extra ?? {}),
        },
        { onConflict: "project_id" },
      );
      if (error) throw error;
      if (extra && "signed_off_at" in extra) setSignedOffAt(extra.signed_off_at ?? null);
      toast({ title: "CRM saved", description: "Crew and pre-flight records updated." });
    } catch (err: any) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addObserver = () => {
    const v = observerDraft.trim();
    if (!v || observers.includes(v) || observers.length >= 8) return;
    setObservers((p) => [...p, v]);
    setObserverDraft("");
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading crew resource management…
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-700 text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Crew Resource Management
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Assign crew roles, run the pre-flight checklist and verify the five hazardous attitudes.
          </p>
        </div>
        {signedOffAt ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] font-semibold text-primary">
            <BadgeCheck className="w-3.5 h-3.5" />
            Signed off {new Date(signedOffAt).toLocaleString()}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            Not signed off
          </span>
        )}
      </div>

      <Tabs defaultValue="crew">
        <TabsList className="w-full">
          <TabsTrigger value="crew" className="flex-1 gap-1.5">
            <Users className="w-3.5 h-3.5" /> Crew
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex-1 gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5" /> Pre-flight
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-secondary text-secondary-foreground font-semibold">
              {checkedCount}/{TOTAL_ITEMS}
            </span>
          </TabsTrigger>
          <TabsTrigger value="attitudes" className="flex-1 gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Attitudes
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-secondary text-secondary-foreground font-semibold">
              {attitudesCount}/5
            </span>
          </TabsTrigger>
        </TabsList>

        {/* ── Crew roles ── */}
        <TabsContent value="crew" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Remote Pilot in Command (RPIC) *</Label>
              <Input value={rpicName} onChange={(e) => setRpicName(e.target.value)} placeholder="Full name" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label>RPIC certificate number</Label>
              <Input value={rpicCert} onChange={(e) => setRpicCert(e.target.value)} placeholder="Part 107 cert #" maxLength={40} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Person Manipulating the Controls (PMC)</Label>
            <Input value={pmcName} onChange={(e) => setPmcName(e.target.value)} placeholder="Leave blank if the RPIC is flying" maxLength={80} />
            <p className="text-[11px] text-muted-foreground">
              If someone other than the RPIC flies the aircraft, the RPIC must maintain direct supervision and immediate control capability.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Visual Observer(s)</Label>
            <div className="flex gap-2">
              <Input
                value={observerDraft}
                onChange={(e) => setObserverDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addObserver(); } }}
                placeholder="Add observer name"
                maxLength={80}
              />
              <Button type="button" variant="outline" size="icon" onClick={addObserver} aria-label="Add visual observer">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {observers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {observers.map((o) => (
                  <span key={o} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                    {o}
                    <button
                      type="button"
                      onClick={() => setObservers((p) => p.filter((x) => x !== o))}
                      aria-label={`Remove ${o}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Crew briefing notes</Label>
            <Textarea
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Comms plan, lost-link procedure, abort criteria, sterile-cockpit rules…"
            />
          </div>
        </TabsContent>

        {/* ── Pre-flight checklist ── */}
        <TabsContent value="checklist" className="space-y-4 pt-4">
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(checkedCount / TOTAL_ITEMS) * 100}%` }}
            />
          </div>
          {CHECKLIST_SECTIONS.map((section) => (
            <div key={section.title} className="rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2 bg-secondary/50">
                <p className="text-xs font-semibold text-foreground">{section.title}</p>
              </div>
              <ul className="divide-y divide-border">
                {section.items.map((item) => {
                  const on = !!checklist[item];
                  return (
                    <li key={item}>
                      <button
                        type="button"
                        onClick={() => setChecklist((p) => ({ ...p, [item]: !p[item] }))}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/30 transition-colors"
                      >
                        <span
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            on ? "bg-primary border-primary" : "border-border bg-background"
                          }`}
                        >
                          {on && <Check className="w-3 h-3 text-primary-foreground" />}
                        </span>
                        <span className={`text-sm ${on ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {item}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setChecklist({})}>
              Reset checklist
            </Button>
          </div>
        </TabsContent>

        {/* ── Five hazardous attitudes ── */}
        <TabsContent value="attitudes" className="space-y-3 pt-4">
          <p className="text-xs text-muted-foreground">
            Confirm that no crew member is exhibiting these attitudes. Acknowledge each one with its antidote before flight.
          </p>
          {ATTITUDES.map((a) => {
            const on = !!attitudes[a.key];
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => setAttitudes((p) => ({ ...p, [a.key]: !p[a.key] }))}
                className={`w-full text-left rounded-xl border p-3 flex gap-3 transition-colors ${
                  on ? "border-primary/40 bg-primary/5" : "border-border hover:bg-secondary/30"
                }`}
              >
                <span
                  className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    on ? "bg-primary border-primary" : "border-border bg-background"
                  }`}
                >
                  {on && <Check className="w-3 h-3 text-primary-foreground" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{a.name}</span>
                  <span className="block text-xs text-muted-foreground italic">{a.thought}</span>
                  <span className="block text-xs text-primary mt-1">Antidote: {a.antidote}</span>
                </span>
              </button>
            );
          })}
          {attitudesCount < ATTITUDES.length && (
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <p className="text-xs text-foreground">
                {ATTITUDES.length - attitudesCount} attitude{ATTITUDES.length - attitudesCount !== 1 ? "s" : ""} still unverified — resolve before launch.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
        <Button type="button" onClick={() => save()} disabled={saving} className="mt-3">
          {saving ? "Saving…" : "Save CRM record"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="mt-3 gap-1.5"
          disabled={saving || !readyToSign}
          onClick={() => save({ signed_off_at: new Date().toISOString() })}
        >
          <ShieldCheck className="w-4 h-4" />
          Sign off as RPIC
        </Button>
        {signedOffAt && (
          <Button
            type="button"
            variant="ghost"
            className="mt-3"
            disabled={saving}
            onClick={() => save({ signed_off_at: null })}
          >
            Clear sign-off
          </Button>
        )}
        {!readyToSign && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            {crewReady ? "Complete every checklist item and attitude check to sign off." : "Enter the RPIC to enable sign-off."}
          </p>
        )}
      </div>
    </div>
  );
}
