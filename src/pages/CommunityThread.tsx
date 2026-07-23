import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowBigUp, ArrowBigDown, Pin, Lock, Flag, MoreHorizontal,
  Trash2, Edit3, ChevronLeft, MessageSquare, Eye, Send,
} from "lucide-react";
import {
  getThread, listPosts, getAuthors, incrementView,
  castVote, getMyVotes, createPost, updatePost, deletePost, deleteThread,
  setThreadFlags, reportContent, amIBanned, AuthorMini, ForumPost, ForumThread,
} from "@/lib/forum";
import { useAuth } from "@/contexts/AuthContext";
import ForumMediaUploader from "@/components/forum/ForumMediaUploader";
import AttachmentGrid from "@/components/forum/AttachmentGrid";
import LinkPreviews from "@/components/forum/LinkPreviews";
import SubscribeButton from "@/components/forum/SubscribeButton";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Share2, User, Briefcase, Video, Sparkles } from "lucide-react";

const QUICK_CHIPS: { label: string; template: string }[] = [
  { label: "Gear I used", template: "Gear I used:\n- Drone: \n- Camera / lens: \n- Software: " },
  { label: "Location", template: "Location / airspace:\n- Site: \n- Class: \n- LAANC: " },
  { label: "Results", template: "Results:\n- GSD / accuracy: \n- Flight time: \n- What worked: \n- What I'd change: " },
  { label: "Ask a question", template: "Question: " },
  { label: "Share portfolio", template: "" }, // handled specially below
];

export default function CommunityThread() {
  const { id = "" } = useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [thread, setThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorMini>>({});
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [myVotes, setMyVotes] = useState<{ threads: Record<string, number>; posts: Record<string, number> }>({ threads: {}, posts: {} });
  const [banned, setBanned] = useState(false);
  const [reportOpen, setReportOpen] = useState<null | { thread_id?: string; post_id?: string }>(null);
  const [reportReason, setReportReason] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<string[]>([]);
  const [editAttachments, setEditAttachments] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");

  async function refresh() {
    const t = await getThread(id);
    setThread(t);
    if (!t) return;
    const p = await listPosts(id);
    setPosts(p);
    const ids = [t.author_id, ...p.map((x) => x.author_id)];
    setAuthors(await getAuthors(ids));
    if (user) {
      setMyVotes(await getMyVotes(user.id, [t.id], p.map((x) => x.id)));
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await refresh();
        incrementView(id).catch(() => {});
      } finally { setLoading(false); }
    })();
  }, [id, user?.id]);

  useEffect(() => {
    if (user) amIBanned(user.id).then(setBanned).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) { setMyUsername(null); return; }
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()
      .then(({ data }) => setMyUsername(data?.username ?? null));
  }, [user]);

  function insertIntoReply(text: string) {
    setReply((prev) => (prev.trim().length === 0 ? text : `${prev.trimEnd()}\n${text}`));
  }
  function applyChip(label: string, template: string) {
    if (label === "Share portfolio") { shareMyPortfolio(); return; }
    insertIntoReply(template);
  }
  function shareMyPortfolio() {
    if (!myUsername) { toast.error("Set a username on your profile first."); return; }
    insertIntoReply(`${window.location.origin}/u/${myUsername}`);
    toast.success("Portfolio link added");
  }
  function shareMyProfile() {
    if (!user) return;
    insertIntoReply(`${window.location.origin}/pilots/${user.id}`);
    toast.success("Profile link added");
  }
  function shareVideoLink() {
    const url = videoUrl.trim();
    if (!/^https?:\/\//i.test(url)) { toast.error("Enter a valid https URL"); return; }
    insertIntoReply(url);
    setVideoUrl("");
    toast.success("Video link added");
  }

  const opAuthor = useMemo(() => thread ? authors[thread.author_id] : undefined, [thread, authors]);

  async function onVoteThread(value: 1 | -1) {
    if (!user) { navigate("/auth"); return; }
    if (!thread) return;
    try {
      await castVote({ thread_id: thread.id }, value, user.id);
      await refresh();
    } catch (err: any) { toast.error(err.message ?? "Vote failed"); }
  }
  async function onVotePost(postId: string, value: 1 | -1) {
    if (!user) { navigate("/auth"); return; }
    try {
      await castVote({ post_id: postId }, value, user.id);
      await refresh();
    } catch (err: any) { toast.error(err.message ?? "Vote failed"); }
  }

  async function onSubmitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { navigate("/auth"); return; }
    if (!thread) return;
    if (reply.trim().length < 1 && replyAttachments.length === 0) return;
    setSubmitting(true);
    try {
      const body = reply.trim().length > 0 ? reply : "(image)";
      await createPost({ thread_id: thread.id, body, author_id: user.id, attachments: replyAttachments });
      setReply("");
      setReplyAttachments([]);
      await refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Reply failed");
    } finally { setSubmitting(false); }
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      await updatePost(editingId, editBody);
      setEditingId(null); setEditBody(""); setEditAttachments([]);
      await refresh();
      toast.success("Edited");
    } catch (err: any) { toast.error(err.message ?? "Update failed"); }
  }

  async function onDeletePost(p: ForumPost) {
    if (!confirm("Delete this post?")) return;
    try { await deletePost(p.id); await refresh(); }
    catch (err: any) { toast.error(err.message ?? "Delete failed"); }
  }

  async function onDeleteThread() {
    if (!thread) return;
    if (!confirm("Delete this entire thread?")) return;
    try { await deleteThread(thread.id); navigate("/community"); }
    catch (err: any) { toast.error(err.message ?? "Delete failed"); }
  }

  async function togglePinned() {
    if (!thread) return;
    await setThreadFlags(thread.id, { pinned: !thread.pinned });
    await refresh();
  }
  async function toggleLocked() {
    if (!thread) return;
    await setThreadFlags(thread.id, { locked: !thread.locked });
    await refresh();
  }

  async function submitReport() {
    if (!user || !reportOpen) return;
    if (reportReason.trim().length < 3) { toast.error("Add a brief reason"); return; }
    try {
      await reportContent({ reporter_id: user.id, ...reportOpen, reason: reportReason });
      toast.success("Report submitted — thanks");
      setReportOpen(null); setReportReason("");
    } catch (err: any) { toast.error(err.message ?? "Report failed"); }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-6 pt-24 pb-16 max-w-3xl"><p>Loading…</p></main>
      </div>
    );
  }
  if (!thread) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-6 pt-24 pb-16 max-w-3xl">
          <p>Thread not found.</p>
          <Link to="/community" className="text-primary underline">Back to community</Link>
        </main>
      </div>
    );
  }

  const myThreadVote = myVotes.threads[thread.id] ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{thread.title} — Community — Dronie</title>
        <meta name="description" content={thread.body.slice(0, 160)} />
        <link rel="canonical" href={`https://dronieapp.com/community/t/${thread.id}`} />
      </Helmet>
      <Navbar />
      <main className="container mx-auto px-6 pt-24 pb-16 max-w-3xl">
        <Link to="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft className="w-4 h-4" /> Community
        </Link>

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            {thread.pinned && <Pin className="w-4 h-4 text-amber-500" />}
            {thread.locked && <Lock className="w-4 h-4 text-muted-foreground" />}
            <h1 className="font-display text-2xl md:text-3xl font-bold">{thread.title}</h1>
          </div>
          <div className="flex items-center gap-2">
          <SubscribeButton threadId={thread.id} userId={user?.id} onRequireAuth={() => navigate("/auth")} />
          {user && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => setReportOpen({ thread_id: thread.id })}
              aria-label="Report thread"
            >
              <Flag className="w-4 h-4" /> Report
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(isAdmin || user?.id === thread.author_id) && (
                <>
                  <DropdownMenuItem onClick={onDeleteThread} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />Delete thread
                  </DropdownMenuItem>
                </>
              )}
              {isAdmin && (
                <>
                  <DropdownMenuItem onClick={togglePinned}>
                    <Pin className="w-4 h-4 mr-2" />{thread.pinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={toggleLocked}>
                    <Lock className="w-4 h-4 mr-2" />{thread.locked ? "Unlock" : "Lock"}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-6">
          <span>by {opAuthor?.username ? `@${opAuthor.username}` : opAuthor?.full_name ?? "Pilot"}</span>
          <span>•</span>
          <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{thread.reply_count}</span>
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{thread.view_count}</span>
        </div>

        <Card className="p-5">
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-1 select-none">
              <button aria-label="Upvote" onClick={() => onVoteThread(1)} className={myThreadVote === 1 ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
                <ArrowBigUp className="w-5 h-5" />
              </button>
              <span className="text-sm font-semibold">{thread.score}</span>
              <button aria-label="Downvote" onClick={() => onVoteThread(-1)} className={myThreadVote === -1 ? "text-destructive" : "text-muted-foreground hover:text-foreground"}>
                <ArrowBigDown className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <Avatar className="w-7 h-7">
                  <AvatarImage src={opAuthor?.avatar_url ?? undefined} />
                  <AvatarFallback>{(opAuthor?.full_name ?? "P")[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{opAuthor?.username ? `@${opAuthor.username}` : opAuthor?.full_name ?? "Pilot"}</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{thread.body}</p>
              {thread.attachments && thread.attachments.length > 0 && (
                <AttachmentGrid urls={thread.attachments} onOpenImage={setLightbox} />
              )}
              <LinkPreviews text={thread.body} />
            </div>
          </div>
        </Card>

        <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-medium mt-8 mb-3">
          {posts.length} {posts.length === 1 ? "reply" : "replies"}
        </h2>

        <div className="space-y-3">
          {posts.length === 0 && (
            <Card className="p-8 text-center border-dashed">
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="font-medium">It's too quiet here.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Be the first to comment — share a tip, a photo, or a link to your latest flight.
              </p>
            </Card>
          )}
          {posts.map((p) => {
            const a = authors[p.author_id];
            const v = myVotes.posts[p.id] ?? 0;
            const canEdit = user?.id === p.author_id || isAdmin;
            const isEditing = editingId === p.id;
            return (
              <Card key={p.id} className="p-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-0.5 select-none">
                    <button aria-label="Upvote" onClick={() => onVotePost(p.id, 1)} className={v === 1 ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
                      <ArrowBigUp className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-semibold">{p.score}</span>
                    <button aria-label="Downvote" onClick={() => onVotePost(p.id, -1)} className={v === -1 ? "text-destructive" : "text-muted-foreground hover:text-foreground"}>
                      <ArrowBigDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={a?.avatar_url ?? undefined} />
                        <AvatarFallback>{(a?.full_name ?? "P")[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{a?.username ? `@${a.username}` : a?.full_name ?? "Pilot"}</span>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                      {p.edited_at && <span className="text-xs text-muted-foreground italic">(edited)</span>}
                      <div className="ml-auto">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user && (
                              <DropdownMenuItem onClick={() => setReportOpen({ post_id: p.id })}>
                                <Flag className="w-4 h-4 mr-2" />Report
                              </DropdownMenuItem>
                            )}
                            {canEdit && (
                              <>
                                <DropdownMenuItem onClick={() => { setEditingId(p.id); setEditBody(p.body); }}>
                                  <Edit3 className="w-4 h-4 mr-2" />Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDeletePost(p)} className="text-destructive">
                                  <Trash2 className="w-4 h-4 mr-2" />Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={5} maxLength={20000} />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                          <Button size="sm" onClick={saveEdit}>Save</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.body}</p>
                        {p.attachments && p.attachments.length > 0 && (
                          <AttachmentGrid urls={p.attachments} onOpenImage={setLightbox} />
                        )}
                        <LinkPreviews text={p.body} />
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-8">
          {!user ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground mb-3">Sign in to join the discussion.</p>
              <Link to="/auth"><Button>Sign in</Button></Link>
            </Card>
          ) : thread.locked ? (
            <Card className="p-6 text-center text-muted-foreground"><Lock className="w-4 h-4 inline mr-1" />This thread is locked.</Card>
          ) : banned ? (
            <Card className="p-6 text-center text-destructive">You are restricted from posting.</Card>
          ) : (
            <form onSubmit={onSubmitReply} className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CHIPS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => applyChip(c.label, c.template)}
                    className="text-xs px-2.5 py-1 rounded-full border border-border/60 bg-muted/40 hover:bg-muted transition text-foreground/80"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} maxLength={20000} placeholder="Write a reply…" />
              <ForumMediaUploader userId={user.id} attachments={replyAttachments} onChange={setReplyAttachments} disabled={submitting} />
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" size="sm" variant="outline" className="gap-2">
                      <Share2 className="w-4 h-4" /> Share
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 space-y-2">
                    <p className="text-xs text-muted-foreground">Add a link to your reply</p>
                    <Button type="button" variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={shareMyPortfolio}>
                      <Briefcase className="w-4 h-4" /> My portfolio
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={shareMyProfile}>
                      <User className="w-4 h-4" /> My pilot profile
                    </Button>
                    <div className="pt-2 border-t space-y-2">
                      <label className="text-xs text-muted-foreground flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> Video URL (YouTube, Vimeo, etc.)</label>
                      <div className="flex gap-1.5">
                        <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" className="h-8 text-xs" />
                        <Button type="button" size="sm" onClick={shareVideoLink}>Add</Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button type="submit" disabled={submitting || (reply.trim().length === 0 && replyAttachments.length === 0)} className="gap-2">
                  <Send className="w-4 h-4" />{submitting ? "Posting…" : "Post reply"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>

      <Dialog open={!!reportOpen} onOpenChange={(o) => { if (!o) { setReportOpen(null); setReportReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report content</DialogTitle></DialogHeader>
          <Textarea placeholder="Why are you reporting this?" value={reportReason} onChange={(e) => setReportReason(e.target.value)} rows={4} maxLength={1000} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(null)}>Cancel</Button>
            <Button onClick={submitReport}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lightbox} onOpenChange={(o) => { if (!o) setLightbox(null); }}>
        <DialogContent className="max-w-5xl p-2 bg-background">
          {lightbox && (
            <img src={lightbox} alt="attachment" className="w-full h-auto max-h-[85vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>

      <FooterSection />
    </div>
  );
}
