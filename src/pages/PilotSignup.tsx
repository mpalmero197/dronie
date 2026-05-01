import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Plane, MapPin, Briefcase, Shield, Plus, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import PilotVerificationBanner from "@/components/PilotVerificationBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { VERTICAL_LABELS, type IndustryVertical } from "@/lib/marketplace";
import {
  pilotProfileSchema,
  getMyPilotProfile,
  SKILL_OPTIONS,
  EQUIPMENT_OPTIONS,
  type PilotProfile,
} from "@/lib/pilots";
import { jitterCoord } from "@/lib/jitter";
import LiabilityNotice from "@/components/LiabilityNotice";
import FleetCatalogPicker from "@/components/pilot/FleetCatalogPicker";

const VERTICAL_KEYS = Object.keys(VERTICAL_LABELS).filter((k) => k !== "other") as IndustryVertical[];

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function CustomDronePicker({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  function commit() {
    if (!value.trim()) return;
    onAdd(value);
    setValue("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="w-3 h-3" />
        Other drone…
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 bg-secondary rounded-full pl-2 pr-1 py-0.5">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setValue("");
            setOpen(false);
          }
        }}
        placeholder="e.g. DJI FlyCart 30"
        maxLength={60}
        className="h-7 w-44 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
      />
      <Button type="button" size="sm" onClick={commit} className="h-7 px-2 text-xs">
        Add
      </Button>
      <button
        type="button"
        onClick={() => {
          setValue("");
          setOpen(false);
        }}
        className="p-1 text-muted-foreground hover:text-destructive"
        aria-label="Cancel"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

export default function PilotSignup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<PilotProfile | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [years, setYears] = useState<string>("0");
  const [rate, setRate] = useState<string>("");
  const [serviceArea, setServiceArea] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [radius, setRadius] = useState<string>("80");
  const [verticals, setVerticals] = useState<IndustryVertical[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [part107, setPart107] = useState(false);
  const [insured, setInsured] = useState(false);
  const [available, setAvailable] = useState(true);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [showOnMap, setShowOnMap] = useState(true);
  const [locationPrivacy, setLocationPrivacy] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    setContactEmail(user.email ?? "");
    getMyPilotProfile(user.id)
      .then((p) => {
        if (p) {
          setExisting(p);
          setDisplayName(p.display_name);
          setContactEmail(p.contact_email ?? user.email ?? "");
          setPhone(p.phone ?? "");
          setBio(p.bio ?? "");
          setYears(String(p.years_experience));
          setRate(p.hourly_rate_cents ? String(p.hourly_rate_cents / 100) : "");
          setServiceArea(p.service_area_label ?? "");
          setLat(p.service_lat?.toString() ?? "");
          setLng(p.service_lng?.toString() ?? "");
          setRadius(String(p.service_radius_km));
          setVerticals(p.verticals);
          setSkills(p.skills);
          setEquipment(p.equipment);
          setPart107(p.part_107);
          setInsured(p.insured);
          setAvailable(p.available);
          setPortfolioUrl(p.portfolio_url ?? "");
          setShowOnMap(p.show_on_map);
          setLocationPrivacy(p.location_privacy);
          setAcceptedTerms(!!p.accepted_terms_at);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation unavailable", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        toast({ title: "Location set" });
      },
      () => toast({ title: "Could not get location", variant: "destructive" })
    );
  }

  async function geocodeArea() {
    if (lat || lng || !serviceArea.trim()) return;
    try {
      const q = encodeURIComponent(serviceArea.trim());
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
        headers: { "Accept-Language": "en" },
      });
      const results = await res.json();
      if (results?.[0]) {
        setLat(parseFloat(results[0].lat).toFixed(6));
        setLng(parseFloat(results[0].lon).toFixed(6));
      }
    } catch { /* silent */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const input = {
      display_name: displayName,
      contact_email: contactEmail || "",
      phone: phone || "",
      bio: bio || "",
      years_experience: years,
      hourly_rate_cents: rate ? Math.round(parseFloat(rate) * 100) : null,
      service_area_label: serviceArea || "",
      service_lat: lat ? parseFloat(lat) : null,
      service_lng: lng ? parseFloat(lng) : null,
      service_radius_km: radius,
      verticals,
      skills,
      equipment,
      part_107: part107,
      insured,
      available,
      portfolio_url: portfolioUrl || "",
      show_on_map: showOnMap,
      location_privacy: locationPrivacy,
      accepted_terms: acceptedTerms,
    };

    const parsed = pilotProfileSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast({
        title: "Check your info",
        description: `${first.path.join(".")}: ${first.message}`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Auto-geocode from service area label if no coords provided
      let sLat = parsed.data.service_lat;
      let sLng = parsed.data.service_lng;
      if (sLat == null && sLng == null && parsed.data.service_area_label) {
        try {
          const q = encodeURIComponent(parsed.data.service_area_label);
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
            headers: { "Accept-Language": "en" },
          });
          const results = await res.json();
          if (results?.[0]) {
            sLat = parseFloat(results[0].lat);
            sLng = parseFloat(results[0].lon);
            // Update form fields so user sees what was resolved
            setLat(sLat.toFixed(6));
            setLng(sLng.toFixed(6));
          }
        } catch {
          // Geocoding failed — continue without coords
        }
      }

      // Compute display coords (jittered or exact based on privacy preference)
      let displayLat: number | null = null;
      let displayLng: number | null = null;
      if (sLat != null && sLng != null) {
        if (parsed.data.location_privacy) {
          const j = jitterCoord(sLat, sLng);
          displayLat = j.lat;
          displayLng = j.lng;
        } else {
          displayLat = sLat;
          displayLng = sLng;
        }
      }
      const payload = {
        ...parsed.data,
        service_lat: sLat,
        service_lng: sLng,
        user_id: user.id,
        contact_email: parsed.data.contact_email || null,
        phone: parsed.data.phone || null,
        bio: parsed.data.bio || null,
        service_area_label: parsed.data.service_area_label || null,
        portfolio_url: parsed.data.portfolio_url || null,
        verticals: parsed.data.verticals as IndustryVertical[],
        display_lat: displayLat,
        display_lng: displayLng,
        accepted_terms_at: existing?.accepted_terms_at ?? new Date().toISOString(),
      };
      // accepted_terms is a form-only flag, not a DB column
      delete (payload as any).accepted_terms;
      const { error } = existing
        ? await supabase.from("pilot_profiles").update(payload as any).eq("user_id", user.id)
        : await supabase.from("pilot_profiles").insert(payload as any);
      if (error) throw error;
      toast({
        title: existing ? "Profile updated" : "You're now a Dronie pilot",
        description: "Clients in your service area can find and book you.",
      });
      navigate("/marketplace");
    } catch (err: any) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-40 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-3xl">
        <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to marketplace
        </Link>

        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Plane className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-700 text-foreground">
              {existing ? "Pilot profile" : "Become a Dronie pilot"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Tell us about yourself, where you fly, and what you can deliver. We'll match you with nearby client requests.
            </p>
          </div>
        </div>

        {existing && <PilotVerificationBanner className="mb-6" />}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* About */}
          <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-display font-700 text-foreground">About you</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={80} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="email">Contact email</Label>
                <Input id="email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} maxLength={255} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="portfolio">Portfolio URL (optional)</Label>
                <Input id="portfolio" type="url" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://…" maxLength={255} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label htmlFor="bio">Short bio</Label>
              <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={800} placeholder="Years flying, notable projects, what makes you a great pilot…" className="mt-1.5" />
              <p className="text-xs text-muted-foreground mt-1">{bio.length}/800</p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="years">Years of experience</Label>
                <Input id="years" type="number" min="0" max="60" value={years} onChange={(e) => setYears(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="rate">Hourly rate (USD, optional)</Label>
                <Input id="rate" type="number" min="0" step="5" value={rate} onChange={(e) => setRate(e.target.value)} className="mt-1.5" />
              </div>
            </div>
          </section>

          {/* Service area */}
          <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <h2 className="font-display font-700 text-foreground">Service area</h2>
            </div>
            <p className="text-sm text-muted-foreground -mt-2">
              Where do you typically fly? We'll only show you requests inside your radius.
            </p>
            <div>
              <Label htmlFor="area">City / region</Label>
              <Input id="area" value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} onBlur={geocodeArea} placeholder="e.g. Austin, TX" maxLength={120} className="mt-1.5" />
              <p className="text-xs text-muted-foreground mt-1">Coordinates will auto-fill when you enter a city name.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="lat">Latitude</Label>
                <Input id="lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="lng">Longitude</Label>
                <Input id="lng" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="radius">Radius (km)</Label>
                <Input id="radius" type="number" min="1" max="2000" value={radius} onChange={(e) => setRadius(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={useMyLocation} className="gap-2">
              <MapPin className="w-3.5 h-3.5" /> Use my current location
            </Button>
          </section>

          {/* Industries */}
          <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              <h2 className="font-display font-700 text-foreground">Industries you serve</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {VERTICAL_KEYS.map((v) => (
                <label key={v} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:border-primary/30 cursor-pointer text-sm">
                  <Checkbox checked={verticals.includes(v)} onCheckedChange={() => setVerticals((p) => toggle(p, v))} />
                  <span className="text-foreground">{VERTICAL_LABELS[v]}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Skills + Equipment */}
          <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-display font-700 text-foreground">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSkills((p) => toggle(p, s))}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    skills.includes(s) ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/70"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2">
              <h2 className="font-display font-700 text-foreground">Your fleet</h2>
              <span className="text-xs text-muted-foreground">
                {equipment.length} drone{equipment.length === 1 ? "" : "s"} selected
              </span>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Pick every drone you fly by manufacturer and model — set the quantity if you operate multiple of the same model. Clients see your full fleet on your profile.
            </p>
            <FleetCatalogPicker value={equipment} onChange={setEquipment} />
          </section>

          {/* Compliance + Availability */}
          <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-display font-700 text-foreground">Credentials & availability</h2>
            <label className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-semibold text-foreground">FAA Part 107 certified</p>
                <p className="text-xs text-muted-foreground">Required for paid commercial work in the US</p>
              </div>
              <Switch checked={part107} onCheckedChange={setPart107} />
            </label>
            <label className="flex items-center justify-between gap-3 py-2 border-t border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">Liability insured</p>
                <p className="text-xs text-muted-foreground">$1M+ aviation liability coverage</p>
              </div>
              <Switch checked={insured} onCheckedChange={setInsured} />
            </label>
            <label className="flex items-center justify-between gap-3 py-2 border-t border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">Currently accepting jobs</p>
                <p className="text-xs text-muted-foreground">Turn off to pause matches</p>
              </div>
              <Switch checked={available} onCheckedChange={setAvailable} />
            </label>
          </section>

          {/* Privacy */}
          <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <h2 className="font-display font-700 text-foreground">Privacy</h2>
            </div>
            <label className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Show me on the public pilot map</p>
                <p className="text-xs text-muted-foreground">Clients can browse pilots in their area at /pilots</p>
              </div>
              <Switch checked={showOnMap} onCheckedChange={setShowOnMap} />
            </label>
            <label className="flex items-center justify-between gap-3 py-2 border-t border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">Hide my exact location (recommended)</p>
                <p className="text-xs text-muted-foreground">
                  Your pin on the public map is shifted by roughly 5 miles in a random direction so clients can see your service
                  area without targeting your exact base. Turn this off only if you're comfortable showing your precise location.
                </p>
              </div>
              <Switch checked={locationPrivacy} onCheckedChange={setLocationPrivacy} />
            </label>
          </section>

          {/* Liability acknowledgement */}
          <LiabilityNotice context="pilot" />
          <label className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card cursor-pointer">
            <Checkbox checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(v === true)} className="mt-0.5" />
            <span className="text-sm text-foreground">
              I confirm I am solely responsible for keeping my certifications, insurance, and regulatory compliance current, and I
              accept the <Link to="/terms" className="text-primary underline">Dronie Terms of Service</Link>.
            </span>
          </label>

          <Button type="submit" disabled={submitting} size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {existing ? "Save profile" : "Join the pilot network"}
          </Button>
        </form>
      </div>
    </div>
  );
}