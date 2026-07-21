import { useState } from "react";
import { Copy, Check, Share2, Rocket, Users, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const SITE = "https://dronieapp.com";

const pilotPitch = `Fly drones? Get paid on Dronieapp — verified pilot jobs in your area, no monthly minimums. Sign up: ${SITE}/pilot-signup`;
const clientPitch = `Need drone photos, maps, or inspections? Get quotes from verified Part 107 pilots on Dronieapp: ${SITE}/marketplace/new`;

const shareTargets = [
  { label: "X / Twitter", url: (t: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}` },
  { label: "Facebook", url: (t: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE)}&quote=${encodeURIComponent(t)}` },
  { label: "LinkedIn", url: (t: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE)}&summary=${encodeURIComponent(t)}` },
  { label: "Reddit", url: (t: string) => `https://www.reddit.com/submit?url=${encodeURIComponent(SITE)}&title=${encodeURIComponent(t)}` },
];

function CopyRow({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
    <div className="flex items-start gap-2">
      <p className="flex-1 text-sm text-foreground bg-muted/40 rounded-lg p-3 border border-border">{text}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast({ title: "Copied", description: "Pitch copied to clipboard." });
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );
}

function ShareButtons({ text }: { text: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {shareTargets.map((s) => (
        <a key={s.label} href={s.url(text)} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Share2 className="w-3 h-3" />
            {s.label}
          </Button>
        </a>
      ))}
    </div>
  );
}

export default function AdminGrowthPanel() {
  const ideas = [
    { icon: Users, title: "Pilot outreach", body: "DM local Part 107 pilots on Instagram/Reddit r/drones. Offer priority marketplace visibility for the first 10 verified in a metro." },
    { icon: Megaphone, title: "Client demand", body: "Cold-email local realtors, roofers, GCs, and inspection firms with the /solutions pages. One vertical per campaign converts best." },
    { icon: Rocket, title: "SEO flywheel", body: "Publish one Field Guide per week. Each guide links to the matching /solutions page and a related pilot search." },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div>
          <h3 className="font-display font-700 text-foreground">Recruit drone pilots</h3>
          <p className="text-xs text-muted-foreground">Share this pitch in pilot communities, subreddits, and Facebook groups.</p>
        </div>
        <CopyRow text={pilotPitch} />
        <ShareButtons text={pilotPitch} />
      </div>

      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div>
          <h3 className="font-display font-700 text-foreground">Attract clients looking for drone services</h3>
          <p className="text-xs text-muted-foreground">Send this to realtors, contractors, roofers, and inspectors.</p>
        </div>
        <CopyRow text={clientPitch} />
        <ShareButtons text={clientPitch} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ideas.map((i) => {
          const Icon = i.icon;
          return (
            <div key={i.title} className="bg-card rounded-xl border border-border p-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <p className="font-semibold text-foreground text-sm">{i.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{i.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}