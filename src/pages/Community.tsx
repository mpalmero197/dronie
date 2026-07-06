import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listCategories, listThreads, getCategoryStats, ForumCategory, ForumThread, ForumCategoryStats } from "@/lib/forum";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, Plus, Pin, Lock, ArrowBigUp, Eye, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Community() {
  const { user } = useAuth();
  const [cats, setCats] = useState<ForumCategory[]>([]);
  const [recent, setRecent] = useState<ForumThread[]>([]);
  const [stats, setStats] = useState<Record<string, ForumCategoryStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, t, s] = await Promise.all([
          listCategories(),
          listThreads(undefined, 10),
          getCategoryStats(),
        ]);
        setCats(c); setRecent(t); setStats(s);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Community Forum — Dronie</title>
        <meta name="description" content="Talk shop with drone pilots: flight planning, photogrammetry, gear, Part 107, and more." />
        <link rel="canonical" href="https://dronieapp.com/community" />
      </Helmet>
      <Navbar />
      <main className="container mx-auto px-6 pt-24 pb-16 max-w-6xl">
        <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">Community</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Ask questions, share missions, talk gear and regulations with other pilots.
            </p>
          </div>
          <Link to={user ? "/community/new" : "/auth"}>
            <Button className="gap-2"><Plus className="w-4 h-4" />New thread</Button>
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-3">
            <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-medium mb-2">Categories</h2>
            {loading ? <div className="text-muted-foreground">Loading…</div> : cats.map((c) => (
              <Link key={c.id} to={`/community/c/${c.slug}`}>
                <Card className="p-4 hover:border-primary/60 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{c.title}</div>
                      {c.description && <p className="text-sm text-muted-foreground mt-0.5">{c.description}</p>}
                    </div>
                    <div className="flex flex-col items-end shrink-0 text-right">
                      <Badge variant="secondary" className="tabular-nums">
                        {stats[c.id]?.post_count ?? 0} {(stats[c.id]?.post_count ?? 0) === 1 ? "post" : "posts"}
                      </Badge>
                      <span className="text-xs text-muted-foreground mt-1 tabular-nums">
                        {stats[c.id]?.thread_count ?? 0} {(stats[c.id]?.thread_count ?? 0) === 1 ? "thread" : "threads"}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </section>

          <aside>
            <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-medium mb-2">Recent activity</h2>
            <div className="space-y-2">
              {recent.length === 0 && <p className="text-sm text-muted-foreground">No threads yet. Be the first!</p>}
              {recent.map((t) => (
                <Link key={t.id} to={`/community/t/${t.id}`}>
                  <Card className="p-3 hover:border-primary/60 transition-colors">
                    <div className="flex items-center gap-1.5 mb-1">
                      {t.pinned && <Pin className="w-3 h-3 text-amber-500" />}
                      {t.locked && <Lock className="w-3 h-3 text-muted-foreground" />}
                      <div className="text-sm font-medium line-clamp-2">{t.title}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><ArrowBigUp className="w-3 h-3" />{t.score}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{t.reply_count}</span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{t.view_count}</span>
                      <span className="flex items-center gap-1 ml-auto"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(t.last_activity_at), { addSuffix: true })}</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </main>
      <FooterSection />
    </div>
  );
}