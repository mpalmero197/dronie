import { useEffect, useRef, useState } from "react";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  listThreadMessages,
  sendThreadMessage,
  subscribeToThread,
  markThreadRead,
  type RequestMessage,
} from "@/lib/messages";

interface Props {
  requestId: string;
  pilotId: string;
  currentUserId: string;
  /** Display name of the other party shown above the thread. */
  counterpartyName: string;
  /** Avatar URL of the other party. */
  counterpartyAvatar?: string | null;
  /** Whether the current user can post (false = read-only). */
  canSend?: boolean;
}

export default function Conversation({
  requestId,
  pilotId,
  currentUserId,
  counterpartyName,
  counterpartyAvatar,
  canSend = true,
}: Props) {
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listThreadMessages(requestId, pilotId)
      .then((m) => {
        if (cancelled) return;
        setMessages(m);
      })
      .catch((err) => {
        if (!cancelled) toast({ title: "Could not load messages", description: err.message, variant: "destructive" });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [requestId, pilotId, toast]);

  // Realtime
  useEffect(() => {
    const off = subscribeToThread(requestId, pilotId, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
    return off;
  }, [requestId, pilotId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Mark as read whenever we see new messages
  useEffect(() => {
    if (loading || messages.length === 0) return;
    markThreadRead(currentUserId, requestId, pilotId).catch(() => {});
  }, [loading, messages.length, currentUserId, requestId, pilotId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const m = await sendThreadMessage(requestId, pilotId, currentUserId, body);
      if (m) setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      setBody("");
    } catch (err: any) {
      toast({ title: "Could not send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  const initials = (counterpartyName || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
          {counterpartyAvatar ? (
            <img src={counterpartyAvatar} alt={counterpartyName} className="w-full h-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-display font-600 text-sm text-foreground truncate">{counterpartyName}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> Direct message
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="px-4 py-4 space-y-2 max-h-[420px] min-h-[180px] overflow-y-auto bg-background/40">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-10">
            No messages yet. Start the conversation below.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary text-foreground rounded-bl-sm"
                  }`}
                >
                  <p>{m.body}</p>
                  <p className={`text-[10px] mt-1 opacity-70`}>
                    {new Date(m.created_at).toLocaleString([], {
                      hour: "numeric",
                      minute: "2-digit",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canSend && (
        <form onSubmit={send} className="p-3 border-t border-border flex gap-2 items-end bg-card">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message…"
            rows={2}
            className="resize-none flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send(e as any);
              }
            }}
          />
          <Button
            type="submit"
            disabled={sending || !body.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </Button>
        </form>
      )}
    </div>
  );
}