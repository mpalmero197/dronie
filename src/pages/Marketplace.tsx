import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Loader2, Filter, Inbox } from "lucide-react";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import RequestCard from "@/components/marketplace/RequestCard";
import {
  listOpenRequests,
  ServiceRequest,
  IndustryVertical,
  VERTICAL_LABELS,
} from "@/lib/marketplace";
import { useAuth } from "@/contexts/AuthContext";

const VERTICAL_FILTERS: (IndustryVertical | "all")[] = [
  "all",
  "construction",
  "real_estate",
  "agriculture",
  "energy",
  "mining",
  "insurance",
  "government",
];

export default function Marketplace() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<IndustryVertical | "all">("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listOpenRequests(filter === "all" ? undefined : { vertical: filter })
      .then((data) => {
        if (!cancelled) setRequests(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="pt-28 pb-10 bg-secondary/40 border-b border-border">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                Marketplace
              </span>
              <h1 className="mt-2 text-4xl font-display font-700 text-foreground">
                Find drone work
              </h1>
              <p className="mt-2 text-muted-foreground max-w-xl">
                Browse open requests from clients across construction, real estate, agriculture and more. Submit a quote and get hired.
              </p>
            </div>
            <div className="flex gap-2">
              {user && (
                <Link to="/marketplace/inbox">
                  <Button variant="outline" className="gap-2">
                    <Inbox className="w-4 h-4" />
                    Inbox
                  </Button>
                </Link>
              )}
              <Link to="/marketplace/new">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 font-semibold">
                  <Plus className="w-4 h-4" />
                  Post a request
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="container mx-auto px-6">
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {VERTICAL_FILTERS.map((v) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  filter === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground hover:bg-secondary/70"
                }`}
              >
                {v === "all" ? "All industries" : VERTICAL_LABELS[v]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading requests…
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-2xl">
              <p className="text-muted-foreground">No open requests in this category yet.</p>
              <Link to="/marketplace/new">
                <Button className="mt-4 gap-2">
                  <Plus className="w-4 h-4" />
                  Be the first to post
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {requests.map((r) => (
                <RequestCard key={r.id} request={r} />
              ))}
            </div>
          )}
        </div>
      </section>

      <FooterSection />
    </div>
  );
}