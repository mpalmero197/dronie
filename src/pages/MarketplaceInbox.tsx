import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, MessageSquare } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RequestCard from "@/components/marketplace/RequestCard";
import { useAuth } from "@/contexts/AuthContext";
import {
  ServiceRequest,
  ServiceQuote,
  listMyRequests,
  listMyQuotes,
  formatBudget,
} from "@/lib/marketplace";
import { getUnreadThreads, type UnreadThread } from "@/lib/messages";

type QuoteWithRequest = ServiceQuote & { service_requests: ServiceRequest | null };

export default function MarketplaceInbox() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [myRequests, setMyRequests] = useState<ServiceRequest[]>([]);
  const [myQuotes, setMyQuotes] = useState<QuoteWithRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState<UnreadThread[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([listMyRequests(user.id), listMyQuotes(user.id), getUnreadThreads(user.id)])
      .then(([r, q, u]) => {
        setMyRequests(r);
        setMyQuotes(q as QuoteWithRequest[]);
        setUnread(u);
      })
      .finally(() => setLoading(false));
  }, [user]);

  // Aggregate unread per request (any thread on that request)
  const unreadByRequest = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of unread) {
      map.set(u.request_id, (map.get(u.request_id) ?? 0) + (u.unread || 0));
    }
    return map;
  }, [unread]);
  const totalUnread = useMemo(() => unread.reduce((s, u) => s + (u.unread || 0), 0), [unread]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-4xl">
        <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to marketplace
        </Link>

        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-700 text-foreground">Inbox</h1>
            {totalUnread > 0 && (
              <p className="text-sm text-primary font-semibold mt-1 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                {totalUnread} unread message{totalUnread === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <Link to="/marketplace/new">
            <Button className="gap-2"><Plus className="w-4 h-4" />New request</Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <Tabs defaultValue="requests">
            <TabsList>
              <TabsTrigger value="requests">My requests ({myRequests.length})</TabsTrigger>
              <TabsTrigger value="quotes">My quotes ({myQuotes.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="requests" className="mt-6">
              {myRequests.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-border rounded-2xl">
                  <p className="text-muted-foreground mb-4">You haven't posted any requests yet.</p>
                  <Link to="/marketplace/new"><Button>Post your first request</Button></Link>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {myRequests.map((r) => {
                    const n = unreadByRequest.get(r.id) ?? 0;
                    return (
                      <div key={r.id} className="relative">
                        <RequestCard request={r} />
                        {n > 0 && (
                          <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary text-primary-foreground shadow">
                            <MessageSquare className="w-3 h-3" /> {n}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="quotes" className="mt-6">
              {myQuotes.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-border rounded-2xl">
                  <p className="text-muted-foreground mb-4">You haven't submitted any quotes yet.</p>
                  <Link to="/marketplace"><Button>Browse open requests</Button></Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {myQuotes.map((q) => {
                    // For pilots, unread is on threads where pilot_id = self
                    const u = unread.find(
                      (x) => x.request_id === q.request_id && x.pilot_id === user!.id,
                    );
                    const n = u?.unread ?? 0;
                    return (
                    <Link
                      key={q.id}
                      to={`/marketplace/${q.request_id}`}
                      className="block p-4 rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-display font-600 text-foreground">
                            {q.service_requests?.title ?? "Request"}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Your bid: ${(q.price_cents / 100).toLocaleString()}
                            {q.eta_days ? ` · ${q.eta_days} days` : ""}
                            {q.service_requests?.budget_cents
                              ? ` · client budget ${formatBudget(q.service_requests.budget_cents)}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            q.status === "accepted" ? "bg-primary/10 text-primary" :
                            q.status === "rejected" ? "bg-destructive/10 text-destructive" :
                            "bg-secondary text-foreground"
                          }`}>{q.status}</span>
                          {n > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary text-primary-foreground">
                              <MessageSquare className="w-3 h-3" /> {n}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}