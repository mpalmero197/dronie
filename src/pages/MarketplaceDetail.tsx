import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar, Briefcase, Loader2, Check, X, Sparkles, ShieldCheck, Plane, MessageSquare, Pencil, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ServiceRequest,
  ServiceQuote,
  VERTICAL_LABELS,
  formatBudget,
  getRequest,
  listQuotesForRequest,
} from "@/lib/marketplace";
import { findMatchingPilots, type MatchedPilot } from "@/lib/pilots";
import Conversation from "@/components/marketplace/Conversation";
import FaaLookupButton from "@/components/marketplace/FaaLookupButton";

interface PilotMini {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  part_107: boolean;
}

export default function MarketplaceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [quotes, setQuotes] = useState<ServiceQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchedPilot[]>([]);
  const [pilotInfo, setPilotInfo] = useState<Record<string, PilotMini>>({});
  const [openThreadPilotId, setOpenThreadPilotId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>("Client");
  const [clientAvatar, setClientAvatar] = useState<string | null>(null);

  // Quote form
  const [price, setPrice] = useState("");
  const [eta, setEta] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function refresh() {
    if (!id) return;
    const r = await getRequest(id);
    setRequest(r);
    if (r) {
      try {
        const q = await listQuotesForRequest(id);
        setQuotes(q);
        const pilotIds = Array.from(new Set(q.map((x) => x.pilot_id)));
        if (pilotIds.length > 0) {
          const { data: pp } = await supabase
            .from("pilot_profiles")
            .select("user_id, display_name, part_107")
            .in("user_id", pilotIds);
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", pilotIds);
          const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
          const map: Record<string, PilotMini> = {};
          for (const pid of pilotIds) {
            const pf = (pp ?? []).find((x: any) => x.user_id === pid);
            const pr: any = profMap.get(pid);
            map[pid] = {
              user_id: pid,
              display_name: pf?.display_name ?? pr?.full_name ?? "Pilot",
              avatar_url: pr?.avatar_url ?? null,
              part_107: !!pf?.part_107,
            };
          }
          setPilotInfo(map);
        }
      } catch {
        setQuotes([]);
      }
      try {
        const m = await findMatchingPilots(id);
        setMatches(m);
      } catch {
        setMatches([]);
      }
      // Load client info (for pilots viewing the request)
      try {
        const { data: c } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", r.client_id)
          .maybeSingle();
        setClientName(c?.full_name ?? "Client");
        setClientAvatar(c?.avatar_url ?? null);
      } catch {
        // ignore
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Verify Stripe checkout return
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const paid = searchParams.get("paid");
    if (paid === "1" && sessionId) {
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke("verify-marketplace-payment", {
            body: { session_id: sessionId },
          });
          if (error) throw error;
          if (data?.paid) {
            toast({ title: "Payment received", description: "Pilot has been assigned to your job." });
            await refresh();
          }
        } catch (err: any) {
          toast({ title: "Could not verify payment", description: err.message, variant: "destructive" });
        } finally {
          searchParams.delete("session_id");
          searchParams.delete("paid");
          setSearchParams(searchParams, { replace: true });
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-40 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="text-center pt-40">
          <p className="text-muted-foreground">Request not found.</p>
          <Link to="/marketplace"><Button className="mt-4">Back to marketplace</Button></Link>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === request.client_id;
  const myQuote = quotes.find((q) => q.pilot_id === user?.id);
  const canPilotMessage = !!user && !isOwner && (!!myQuote || request.assigned_pilot_id === user.id);

  async function submitQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !request) return;
    if (!price) {
      toast({ title: "Price required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("service_quotes").insert({
        request_id: request.id,
        pilot_id: user.id,
        price_cents: Math.round(parseFloat(price) * 100),
        eta_days: eta ? parseInt(eta) : null,
        message: message.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Quote submitted" });
      setPrice(""); setEta(""); setMessage("");
      await refresh();
    } catch (err: any) {
      toast({ title: "Could not submit", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function acceptQuote(quote: ServiceQuote) {
    if (!request) return;
    try {
      toast({ title: "Redirecting to secure checkout…" });
      const { data, error } = await supabase.functions.invoke("create-marketplace-checkout", {
        body: { quote_id: quote.id },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast({ title: "Could not start checkout", description: err.message, variant: "destructive" });
    }
  }

  async function rejectQuote(quote: ServiceQuote) {
    try {
      const { error } = await supabase
        .from("service_quotes")
        .update({ status: "rejected" })
        .eq("id", quote.id);
      if (error) throw error;
      await refresh();
    } catch (err: any) {
      toast({ title: "Could not update", description: err.message, variant: "destructive" });
    }
  }

  async function deleteRequest() {
    if (!request) return;
    if (!confirm("Delete this request? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("service_requests")
        .delete()
        .eq("id", request.id);
      if (error) throw error;
      toast({ title: "Request deleted" });
      navigate("/marketplace");
    } catch (err: any) {
      toast({ title: "Could not delete", description: err.message, variant: "destructive" });
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-4xl">
        <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> All requests
        </Link>

        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                {request.status}
              </span>
              <h1 className="mt-3 text-2xl font-display font-700 text-foreground">{request.title}</h1>
            </div>
            <div className="text-right">
              <p className="text-2xl font-display font-700 text-primary">{formatBudget(request.budget_cents)}</p>
              <p className="text-xs text-muted-foreground">budget</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground mb-4">
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" /> {VERTICAL_LABELS[request.vertical]}
            </span>
            {request.location_label && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> {request.location_label}
              </span>
            )}
            {request.deadline && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> Due {new Date(request.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
          {request.description && (
            <p className="text-foreground/90 whitespace-pre-wrap mb-4">{request.description}</p>
          )}
          {request.deliverables.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {request.deliverables.map((d) => (
                <span key={d} className="px-3 py-1 rounded-full bg-secondary text-xs font-medium text-foreground">
                  {d}
                </span>
              ))}
            </div>
          )}
          {isOwner && (
            <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-border">
              <Link to={`/marketplace/${request.id}/edit`}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Edit request
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                onClick={deleteRequest}
                disabled={deleting}
                className="gap-1.5 hover:border-destructive hover:text-destructive"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </Button>
            </div>
          )}
        </div>

        {/* Quote form for non-owners */}
        {!isOwner && user && request.status === "open" && !myQuote && (
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="font-display font-700 text-lg text-foreground mb-4">Submit your quote</h2>
            <form onSubmit={submitQuote} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Your price (USD)</Label>
                  <Input id="price" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="eta">ETA (days)</Label>
                  <Input id="eta" type="number" min="1" value={eta} onChange={(e) => setEta(e.target.value)} className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label htmlFor="message">Message to client</Label>
                <Textarea id="message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1.5" placeholder="Why you're a great fit, equipment, sample work…" />
              </div>
              <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Submit quote
              </Button>
            </form>
          </div>
        )}

        {!user && (
          <div className="bg-card rounded-2xl border border-border p-6 mb-6 text-center">
            <p className="text-muted-foreground mb-3">Sign in to submit a quote.</p>
            <Button onClick={() => navigate("/auth")}>Sign in</Button>
          </div>
        )}

        {myQuote && !isOwner && (
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="font-display font-700 text-lg text-foreground mb-2">Your quote</h2>
            <p className="text-sm text-muted-foreground">
              Status: <span className="font-semibold text-foreground">{myQuote.status}</span> · ${(myQuote.price_cents / 100).toLocaleString()}
              {myQuote.eta_days ? ` · ${myQuote.eta_days} days` : ""}
            </p>
          </div>
        )}

        {/* Quote list (owner sees all; pilots see only their own per RLS) */}
        {(isOwner || quotes.length > 0) && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="font-display font-700 text-lg text-foreground mb-4">
              {isOwner ? `Quotes (${quotes.length})` : "Quote activity"}
            </h2>
            {quotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quotes yet.</p>
            ) : (
              <div className="space-y-3">
                {quotes.map((q) => (
                  <div key={q.id} className="p-4 rounded-xl border border-border bg-background">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-display font-600 text-foreground">
                          {isOwner && pilotInfo[q.pilot_id] ? (
                            <span className="mr-2">{pilotInfo[q.pilot_id].display_name} · </span>
                          ) : null}
                          ${(q.price_cents / 100).toLocaleString()}
                          {q.eta_days && <span className="text-sm text-muted-foreground font-normal"> · {q.eta_days} days</span>}
                        </p>
                        {q.message && <p className="text-sm text-muted-foreground mt-1">{q.message}</p>}
                        {isOwner && pilotInfo[q.pilot_id]?.part_107 && (
                          <div className="mt-2">
                            <FaaLookupButton
                              displayName={pilotInfo[q.pilot_id].display_name}
                              size="compact"
                            />
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        q.status === "accepted" ? "bg-primary/10 text-primary" :
                        q.status === "rejected" ? "bg-destructive/10 text-destructive" :
                        "bg-secondary text-foreground"
                      }`}>{q.status}</span>
                    </div>
                    {isOwner && q.status === "pending" && request.status === "open" && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => acceptQuote(q)} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
                          <Check className="w-3.5 h-3.5" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => rejectQuote(q)} className="gap-1.5">
                          <X className="w-3.5 h-3.5" /> Decline
                        </Button>
                        {isOwner && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setOpenThreadPilotId(openThreadPilotId === q.pilot_id ? null : q.pilot_id)}
                            className="gap-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            {openThreadPilotId === q.pilot_id ? "Close chat" : "Message"}
                          </Button>
                        )}
                      </div>
                    )}
                    {isOwner && (q.status !== "pending" || request.status !== "open") && (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOpenThreadPilotId(openThreadPilotId === q.pilot_id ? null : q.pilot_id)}
                          className="gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {openThreadPilotId === q.pilot_id ? "Close chat" : "Message pilot"}
                        </Button>
                      </div>
                    )}
                    {isOwner && openThreadPilotId === q.pilot_id && user && (
                      <div className="mt-4">
                        <Conversation
                          requestId={request.id}
                          pilotId={q.pilot_id}
                          currentUserId={user.id}
                          counterpartyName={pilotInfo[q.pilot_id]?.display_name ?? "Pilot"}
                          counterpartyAvatar={pilotInfo[q.pilot_id]?.avatar_url ?? null}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pilot-side conversation with client */}
        {canPilotMessage && user && (
          <div className="mt-6">
            <h2 className="font-display font-700 text-lg text-foreground mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" /> Message client
            </h2>
            <Conversation
              requestId={request.id}
              pilotId={user.id}
              currentUserId={user.id}
              counterpartyName={clientName}
              counterpartyAvatar={clientAvatar}
            />
          </div>
        )}

        {/* Matched pilots — owner only */}
        {isOwner && matches.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-6 mt-6">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="font-display font-700 text-lg text-foreground">
                Matched pilots ({matches.length})
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Pilots whose service area covers this job and who work in {VERTICAL_LABELS[request.vertical]}.
            </p>
            <div className="space-y-3">
              {matches.map((m) => (
                <div key={m.pilot_id} className="p-4 rounded-xl border border-border bg-background">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-display font-600 text-foreground inline-flex items-center gap-2">
                          <Plane className="w-3.5 h-3.5 text-primary" />
                          {m.display_name}
                        </p>
                        {m.part_107 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                            <ShieldCheck className="w-3 h-3" /> Part 107
                          </span>
                        )}
                        {m.insured && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary text-foreground">
                            Insured
                          </span>
                        )}
                        {m.part_107 && (
                          <FaaLookupButton displayName={m.display_name} size="compact" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {m.service_area_label ?? "—"}
                        {m.distance_km != null && ` · ${Math.round(m.distance_km)} km away`}
                        {m.years_experience > 0 && ` · ${m.years_experience} yr exp`}
                        {m.hourly_rate_cents && ` · $${m.hourly_rate_cents / 100}/hr`}
                      </p>
                    </div>
                    {m.portfolio_url && (
                      <a href={m.portfolio_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline">View work</Button>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}