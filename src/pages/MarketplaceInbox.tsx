import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
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

type QuoteWithRequest = ServiceQuote & { service_requests: ServiceRequest | null };

export default function MarketplaceInbox() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [myRequests, setMyRequests] = useState<ServiceRequest[]>([]);
  const [myQuotes, setMyQuotes] = useState<QuoteWithRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([listMyRequests(user.id), listMyQuotes(user.id)])
      .then(([r, q]) => {
        setMyRequests(r);
        setMyQuotes(q as QuoteWithRequest[]);
      })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-4xl">
        <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to marketplace
        </Link>

        <div className="flex items-end justify-between mb-6">
          <h1 className="text-3xl font-display font-700 text-foreground">Inbox</h1>
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
                  {myRequests.map((r) => <RequestCard key={r.id} request={r} />)}
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
                  {myQuotes.map((q) => (
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
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          q.status === "accepted" ? "bg-primary/10 text-primary" :
                          q.status === "rejected" ? "bg-destructive/10 text-destructive" :
                          "bg-secondary text-foreground"
                        }`}>{q.status}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}