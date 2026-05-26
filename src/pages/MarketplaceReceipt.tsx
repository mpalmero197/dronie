import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2, Clock, XCircle, Printer, ExternalLink } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VERTICAL_LABELS, formatBudget } from "@/lib/marketplace";

interface ReceiptData {
  request: any;
  quote: any | null;
  payment: any | null;
  stripe_session: any | null;
  stripe_payment_intent: any | null;
}

function statusBadge(status: string | undefined | null) {
  const s = (status ?? "unknown").toLowerCase();
  if (s === "paid" || s === "succeeded") {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary"><CheckCircle2 className="w-3.5 h-3.5" /> Paid</span>;
  }
  if (s === "pending" || s === "processing" || s === "requires_payment_method" || s === "requires_action" || s === "open") {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600"><Clock className="w-3.5 h-3.5" /> {s}</span>;
  }
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive"><XCircle className="w-3.5 h-3.5" /> {s}</span>;
}

function money(cents: number | null | undefined, currency: string = "usd") {
  if (cents == null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function fmtDate(ts: number | string | null | undefined) {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleString();
}

export default function MarketplaceReceipt() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !id) { setLoading(false); return; }
    (async () => {
      try {
        const { data: res, error: err } = await supabase.functions.invoke("marketplace-receipt", {
          body: { request_id: id, session_id: sessionId },
        });
        if (err) throw err;
        if ((res as any)?.error) throw new Error((res as any).error);
        setData(res as ReceiptData);
      } catch (e: any) {
        setError(e.message ?? "Failed to load receipt");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, sessionId, user, authLoading]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-40 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading receipt…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="text-center pt-40">
          <p className="text-muted-foreground mb-3">Sign in to view this receipt.</p>
          <Link to="/auth"><Button>Sign in</Button></Link>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="text-center pt-40">
          <p className="text-destructive mb-3">{error ?? "Receipt not available."}</p>
          <Link to={`/marketplace/${id}`}><Button variant="outline">Back to request</Button></Link>
        </div>
      </div>
    );
  }

  const { request, quote, payment, stripe_session, stripe_payment_intent } = data;
  const currency = payment?.currency ?? stripe_session?.currency ?? "usd";
  const total = payment?.amount_total_cents ?? stripe_session?.amount_total ?? quote?.price_cents;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-3xl">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link to={`/marketplace/${id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to request
          </Link>
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Marketplace receipt</p>
              <h1 className="mt-1 text-2xl font-display font-700 text-foreground">{request.title}</h1>
            </div>
            {statusBadge(payment?.status ?? stripe_session?.payment_status)}
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Vertical</p>
              <p className="font-medium text-foreground">{VERTICAL_LABELS[request.vertical]}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Budget</p>
              <p className="font-medium text-foreground">{formatBudget(request.budget_cents)}</p>
            </div>
            {request.location_label && (
              <div>
                <p className="text-muted-foreground">Location</p>
                <p className="font-medium text-foreground">{request.location_label}</p>
              </div>
            )}
            {request.deadline && (
              <div>
                <p className="text-muted-foreground">Deadline</p>
                <p className="font-medium text-foreground">{new Date(request.deadline).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>

        {quote && (
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="font-display font-700 text-lg text-foreground mb-4">Accepted quote</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Quote price</p>
                <p className="font-medium text-foreground">{money(quote.price_cents, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">ETA</p>
                <p className="font-medium text-foreground">{quote.eta_days ? `${quote.eta_days} days` : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Quote status</p>
                <p className="font-medium text-foreground capitalize">{quote.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Payment status</p>
                <p className="font-medium text-foreground capitalize">{quote.payment_status}</p>
              </div>
              {quote.message && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Message</p>
                  <p className="font-medium text-foreground whitespace-pre-wrap">{quote.message}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="font-display font-700 text-lg text-foreground mb-4">Payment</h2>
          {!payment && !stripe_session ? (
            <p className="text-sm text-muted-foreground">No payment has been recorded for this request yet.</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total charged</p>
                  <p className="font-display font-700 text-2xl text-primary">{money(total, currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pilot earnings</p>
                  <p className="font-medium text-foreground">{money(payment?.amount_pilot_cents, currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Platform fee</p>
                  <p className="font-medium text-foreground">{money(payment?.fee_cents, currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Currency</p>
                  <p className="font-medium text-foreground uppercase">{currency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Internal status</p>
                  <p>{statusBadge(payment?.status)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Stripe status</p>
                  <p>{statusBadge(stripe_session?.payment_status ?? stripe_payment_intent?.status)}</p>
                </div>
                {payment?.created_at && (
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium text-foreground">{fmtDate(payment.created_at)}</p>
                  </div>
                )}
                {stripe_session?.customer_email && (
                  <div>
                    <p className="text-muted-foreground">Receipt email</p>
                    <p className="font-medium text-foreground">{stripe_session.customer_email}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-5 border-t border-border space-y-2 text-xs font-mono text-muted-foreground break-all">
                {payment?.id && <p>Payment ID: {payment.id}</p>}
                {payment?.stripe_session_id && <p>Stripe session: {payment.stripe_session_id}</p>}
                {(payment?.stripe_payment_intent_id ?? stripe_payment_intent?.id) && (
                  <p>Payment intent: {payment?.stripe_payment_intent_id ?? stripe_payment_intent?.id}</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <Link to={`/marketplace/${id}`}>
            <Button variant="outline" className="gap-1.5"><ArrowLeft className="w-3.5 h-3.5" /> Request details</Button>
          </Link>
          <Link to="/marketplace/inbox">
            <Button variant="outline" className="gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Inbox</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}