import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { listCategories, createThread, ForumCategory, amIBanned } from "@/lib/forum";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft } from "lucide-react";
import ForumMediaUploader from "@/components/forum/ForumMediaUploader";

const Schema = z.object({
  category_id: z.string().uuid({ message: "Pick a category" }),
  title: z.string().trim().min(3, "Title too short").max(200, "Title too long"),
  body: z.string().trim().min(10, "Add a few more details").max(20000, "Too long"),
});

export default function CommunityNewThread() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialSlug = params.get("category");
  const [cats, setCats] = useState<ForumCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [banned, setBanned] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    (async () => {
      const list = await listCategories();
      setCats(list);
      if (initialSlug) {
        const m = list.find((c) => c.slug === initialSlug);
        if (m) setCategoryId(m.id);
      }
    })();
  }, [initialSlug]);

  useEffect(() => {
    if (user) amIBanned(user.id).then(setBanned).catch(() => {});
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = Schema.safeParse({ category_id: categoryId, title, body });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    try {
      const { category_id, title: tt, body: bb } = parsed.data;
      const t = await createThread({ category_id: category_id!, title: tt!, body: bb!, author_id: user.id, attachments });
      toast.success("Thread posted");
      navigate(`/community/t/${t.id}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to post");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>New thread — Community — Dronie</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navbar />
      <main className="container mx-auto px-6 pt-24 pb-16 max-w-2xl">
        <Link to="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft className="w-4 h-4" /> Back to community
        </Link>
        <h1 className="font-display text-3xl font-bold mb-6">Start a new thread</h1>

        {banned ? (
          <Card className="p-6 border-destructive/40 bg-destructive/5">
            <p className="font-semibold text-destructive">You are currently restricted from posting.</p>
            <p className="text-sm text-muted-foreground mt-1">Contact support if you believe this is a mistake.</p>
          </Card>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="A clear, specific question or topic" />
            </div>
            <div>
              <Label htmlFor="body">Details</Label>
              <Textarea id="body" value={body} maxLength={20000} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="Share context, what you've tried, links, etc." />
              <p className="text-xs text-muted-foreground mt-1">Plain text supported. Be respectful — see community guidelines.</p>
            </div>
            {user && (
              <div>
                <Label>Images (optional)</Label>
                <div className="mt-2">
                  <ForumMediaUploader userId={user.id} attachments={attachments} onChange={setAttachments} disabled={submitting} />
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Link to="/community"><Button type="button" variant="outline">Cancel</Button></Link>
              <Button type="submit" disabled={submitting}>{submitting ? "Posting…" : "Post thread"}</Button>
            </div>
          </form>
        )}
      </main>
      <FooterSection />
    </div>
  );
}