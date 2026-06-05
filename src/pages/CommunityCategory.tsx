import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowBigUp, Eye, MessageSquare, Pin, Lock, Plus, ChevronLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  getCategoryBySlug, listThreads, ForumCategory, ForumThread, getAuthors, AuthorMini,
} from "@/lib/forum";
import { useAuth } from "@/contexts/AuthContext";

export default function CommunityCategory() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const [cat, setCat] = useState<ForumCategory | null>(null);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorMini>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const c = await getCategoryBySlug(slug);
        setCat(c);
        if (c) {
          const t = await listThreads(c.id, 100);
          setThreads(t);
          setAuthors(await getAuthors(t.map((x) => x.author_id)));
        }
      } finally { setLoading(false); }
    })();
  }, [slug]);

  if (!loading && !cat) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-6 pt-24 pb-16 max-w-4xl">
          <p>Category not found.</p>
          <Link to="/community" className="text-primary underline">Back to community</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{cat ? `${cat.title} — Community` : "Community"} — Dronie</title>
        <meta name="description" content={cat?.description ?? "Drone pilot community discussions."} />
        <link rel="canonical" href={`https://dronieapp.com/community/c/${slug}`} />
      </Helmet>
      <Navbar />
      <main className="container mx-auto px-6 pt-24 pb-16 max-w-4xl">
        <Link to="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft className="w-4 h-4" /> All categories
        </Link>
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-bold">{cat?.title}</h1>
            {cat?.description && <p className="text-muted-foreground mt-1">{cat.description}</p>}
          </div>
          <Link to={user ? `/community/new?category=${slug}` : "/auth"}>
            <Button className="gap-2"><Plus className="w-4 h-4" />New thread</Button>
          </Link>
        </div>

        <div className="space-y-2">
          {loading && <p className="text-muted-foreground">Loading…</p>}
          {!loading && threads.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">No threads yet — start the conversation.</Card>
          )}
          {threads.map((t) => {
            const a = authors[t.author_id];
            return (
              <Link key={t.id} to={`/community/t/${t.id}`}>
                <Card className="p-4 hover:border-primary/60 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center justify-center px-2 min-w-[44px]">
                      <ArrowBigUp className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">{t.score}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {t.pinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                        {t.locked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                        <h3 className="font-semibold truncate">{t.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{t.body}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                        <span>by {a?.username ? `@${a.username}` : a?.full_name ?? "Pilot"}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{t.reply_count}</span>
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{t.view_count}</span>
                        <span className="ml-auto">{formatDistanceToNow(new Date(t.last_activity_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
      <FooterSection />
    </div>
  );
}