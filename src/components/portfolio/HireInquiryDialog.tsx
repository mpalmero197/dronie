import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const InquirySchema = z.object({
  sender_name: z.string().trim().min(2, "Name is required").max(120),
  sender_email: z.string().trim().email("Valid email required").max(255),
  subject: z.string().trim().max(160).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Tell them a bit more (min 10 chars)").max(2000),
  project_ref: z.string().trim().max(200).optional().or(z.literal("")),
  budget_cents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  timeline: z.string().trim().max(120).optional().or(z.literal("")),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  ownerDisplayName: string;
  /** Pre-fill the project / album the visitor is browsing */
  projectRef?: string | null;
}

export default function HireInquiryDialog({
  open, onOpenChange, ownerId, ownerDisplayName, projectRef,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [ref, setRef] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");

  // Auto-fill from signed-in user + URL context whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    setDone(false);
    setName((prev) => prev || (user?.user_metadata?.full_name as string) || "");
    setEmail((prev) => prev || user?.email || "");
    setSubject((prev) => prev || `Hiring inquiry for ${ownerDisplayName}`);
    setRef((prev) => prev || projectRef || "");
  }, [open, user, ownerDisplayName, projectRef]);

  const defaultSubject = useMemo(
    () => `Hiring inquiry for ${ownerDisplayName}${projectRef ? ` — ${projectRef}` : ""}`,
    [ownerDisplayName, projectRef]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = InquirySchema.safeParse({
      sender_name: name,
      sender_email: email,
      subject: subject || defaultSubject,
      message,
      project_ref: ref,
      budget_cents: budget ? Math.round(parseFloat(budget) * 100) : null,
      timeline,
    });
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Check your inputs";
      toast({ title: "Could not send", description: first, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("portfolio_inquiries").insert({
        owner_id: ownerId,
        sender_name: parsed.data.sender_name,
        sender_email: parsed.data.sender_email,
        subject: parsed.data.subject || defaultSubject,
        message: parsed.data.message,
        project_ref: parsed.data.project_ref || null,
        budget_cents: parsed.data.budget_cents ?? null,
        timeline: parsed.data.timeline || null,
        source_url: typeof window !== "undefined" ? window.location.href : null,
      });
      if (error) throw error;
      setDone(true);
      toast({ title: "Inquiry sent", description: `${ownerDisplayName} will get back to you soon.` });
    } catch (err: any) {
      toast({ title: "Could not send", description: err.message ?? "Please try again", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Hire {ownerDisplayName}</DialogTitle>
          <DialogDescription>
            Send a short brief. They'll reply by email — no account needed.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-primary mb-3" />
            <p className="font-display font-700 text-foreground">Inquiry delivered</p>
            <p className="text-sm text-muted-foreground mt-1">
              We sent your brief to {ownerDisplayName}. Keep an eye on {email}.
            </p>
            <Button className="mt-5" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="hire-name">Your name</Label>
                <Input id="hire-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="hire-email">Your email</Label>
                <Input id="hire-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label htmlFor="hire-subject">Subject</Label>
              <Input id="hire-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={defaultSubject} maxLength={160} className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="hire-budget">Budget (USD)</Label>
                <Input id="hire-budget" type="number" min="0" step="50" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="optional" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="hire-timeline">Timeline</Label>
                <Input id="hire-timeline" value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="e.g. next 2 weeks" maxLength={120} className="mt-1.5" />
              </div>
            </div>
            {ref && (
              <div>
                <Label htmlFor="hire-ref">Project / album</Label>
                <Input id="hire-ref" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={200} className="mt-1.5" />
              </div>
            )}
            <div>
              <Label htmlFor="hire-message">Your message</Label>
              <Textarea
                id="hire-message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={2000}
                placeholder={`Hi ${ownerDisplayName}, I'd love to hire you for…`}
                className="mt-1.5"
              />
              <p className="text-[11px] text-muted-foreground mt-1 text-right">{message.length}/2000</p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="gap-1.5">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send inquiry
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}