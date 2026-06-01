import { useEffect, useState } from "react";
import { Loader2, Key, Save, Trash2, Plus, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type Entry = {
  name: string;
  category: string;
  hint: string;
  is_set: boolean;
  updated_at: string | null;
};

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  processing: {
    label: "Photogrammetry",
    description: "Used by drone-image processing (orthomosaics, point clouds, meshes).",
  },
  splats: {
    label: "Gaussian Splatting",
    description: "Used by the GPU splat trainer.",
  },
  fleet: {
    label: "Live Fleet & Streaming",
    description: "Used by live drone telemetry and RTMP video ingest.",
  },
  other: {
    label: "Other",
    description: "Miscellaneous service credentials.",
  },
};

async function callApi(method: string, body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/admin-secrets`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export default function ApiKeysManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customValue, setCustomValue] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await callApi("GET");
      setEntries(data.entries ?? []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveOne(name: string, value: string, category?: string) {
    if (!value.trim()) return;
    setSaving(name);
    try {
      await callApi("PUT", { name, value, category });
      toast({ title: "Saved", description: `${name} stored encrypted.` });
      setDrafts((d) => ({ ...d, [name]: "" }));
      await load();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  async function removeOne(name: string) {
    if (!confirm(`Remove ${name}? Any feature relying on it will stop working.`)) return;
    setSaving(name);
    try {
      await callApi("DELETE", { name });
      toast({ title: "Removed", description: name });
      await load();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  const grouped = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    (acc[e.category] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Key className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-display font-700 text-foreground">API Keys</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            Stored encrypted at rest (pgcrypto · AES). Decrypted only inside backend functions.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {Object.entries(CATEGORY_META).map(([cat, meta]) => {
            const rows = grouped[cat] ?? [];
            if (rows.length === 0) return null;
            return (
              <section key={cat} className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
                {rows.map((e) => {
                  const value = drafts[e.name] ?? "";
                  const revealed = reveal[e.name];
                  const isMultiline = value.length > 80 || value.includes("\n");
                  return (
                    <div key={e.name} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <code className="text-xs font-mono text-foreground">{e.name}</code>
                          <p className="text-xs text-muted-foreground mt-0.5">{e.hint}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {e.is_set ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              Set · {e.updated_at ? new Date(e.updated_at).toLocaleDateString() : ""}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                              Not set
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-stretch gap-2">
                        {isMultiline ? (
                          <Textarea
                            value={value}
                            onChange={(ev) => setDrafts((d) => ({ ...d, [e.name]: ev.target.value }))}
                            placeholder={e.is_set ? "Enter new value to rotate" : "Paste value"}
                            className="font-mono text-xs"
                            rows={3}
                          />
                        ) : (
                          <div className="relative flex-1">
                            <Input
                              type={revealed ? "text" : "password"}
                              value={value}
                              onChange={(ev) => setDrafts((d) => ({ ...d, [e.name]: ev.target.value }))}
                              placeholder={e.is_set ? "Enter new value to rotate" : "Paste value"}
                              className="font-mono text-xs pr-9"
                              autoComplete="off"
                            />
                            <button
                              type="button"
                              onClick={() => setReveal((r) => ({ ...r, [e.name]: !r[e.name] }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              aria-label={revealed ? "Hide" : "Reveal"}
                            >
                              {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                        <Button
                          size="sm"
                          disabled={!value.trim() || saving === e.name}
                          onClick={() => saveOne(e.name, value, e.category)}
                          className="gap-1.5"
                        >
                          {saving === e.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save
                        </Button>
                        {e.is_set && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving === e.name}
                            onClick={() => removeOne(e.name)}
                            className="gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}

          <section className="p-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Add custom secret</h3>
              <p className="text-xs text-muted-foreground">Any other key your backend functions need.</p>
            </div>
            <div className="grid sm:grid-cols-[1fr_2fr_auto] gap-2">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                  placeholder="MY_SERVICE_TOKEN"
                  className="font-mono text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Value</Label>
                <Input
                  type="password"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="Paste value"
                  className="font-mono text-xs mt-1"
                  autoComplete="off"
                />
              </div>
              <Button
                size="sm"
                disabled={!customName || !customValue || saving === customName}
                onClick={async () => {
                  await saveOne(customName, customValue, "other");
                  setCustomName("");
                  setCustomValue("");
                }}
                className="gap-1.5 self-end"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}