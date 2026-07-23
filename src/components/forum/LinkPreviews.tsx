import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, User as UserIcon, ExternalLink, PlayCircle } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";

// ---------- URL parsing ----------

const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/gi;

export function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_RE) ?? [];
  return Array.from(new Set(matches)).slice(0, 4);
}

function youTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/\/(embed|shorts)\/([\w-]+)/);
      if (m) return m[2];
    }
  } catch {}
  return null;
}

function vimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("vimeo.com")) return null;
    const m = u.pathname.match(/\/(\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function internalPortfolio(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.origin !== window.location.origin) return null;
    const m = u.pathname.match(/^\/u\/([\w.-]+)/);
    return m ? m[1] : null;
  } catch { return null; }
}

function internalPilot(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.origin !== window.location.origin) return null;
    const m = u.pathname.match(/^\/pilots\/([0-9a-f-]{36})/i);
    return m ? m[1] : null;
  } catch { return null; }
}

// ---------- Individual previews ----------

function YouTubePreview({ id, url }: { id: string; url: string }) {
  return (
    <Card className="overflow-hidden">
      <a href={url} target="_blank" rel="noopener noreferrer" className="block group">
        <div className="relative aspect-video bg-black">
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt="YouTube video thumbnail"
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <PlayCircle className="w-14 h-14 absolute inset-0 m-auto text-white/90 drop-shadow-lg group-hover:scale-110 transition" />
        </div>
        <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
          <ExternalLink className="w-3 h-3" /> youtube.com
        </div>
      </a>
    </Card>
  );
}

function VimeoPreview({ id, url }: { id: string; url: string }) {
  const [meta, setMeta] = useState<{ title?: string; thumb?: string } | null>(null);
  useEffect(() => {
    let cancel = false;
    fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancel && d) setMeta({ title: d.title, thumb: d.thumbnail_url }); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [id]);
  return (
    <Card className="overflow-hidden">
      <a href={url} target="_blank" rel="noopener noreferrer" className="block group">
        <div className="relative aspect-video bg-black">
          {meta?.thumb && <img src={meta.thumb} alt="" className="w-full h-full object-cover" loading="lazy" />}
          <PlayCircle className="w-14 h-14 absolute inset-0 m-auto text-white/90 drop-shadow-lg group-hover:scale-110 transition" />
        </div>
        <div className="px-3 py-2 text-xs">
          <div className="font-medium truncate">{meta?.title ?? "Vimeo video"}</div>
          <div className="text-muted-foreground flex items-center gap-1.5 mt-0.5"><ExternalLink className="w-3 h-3" /> vimeo.com</div>
        </div>
      </a>
    </Card>
  );
}

function PortfolioPreview({ username }: { username: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    let cancel = false;
    supabase.rpc("get_public_portfolio", { _username: username })
      .then(({ data }) => { if (!cancel) setData(Array.isArray(data) ? data[0] : data); });
    return () => { cancel = true; };
  }, [username]);
  return (
    <Card className="overflow-hidden">
      <RouterLink to={`/u/${username}`} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition">
        <div className="w-14 h-14 rounded-md bg-muted flex-shrink-0 overflow-hidden">
          {data?.avatar_url ? (
            <img src={data.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Briefcase className="w-6 h-6 text-muted-foreground" /></div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-primary font-semibold">Portfolio</div>
          <div className="font-medium truncate">{data?.full_name ?? `@${username}`}</div>
          <div className="text-xs text-muted-foreground line-clamp-1">{data?.headline ?? data?.bio ?? `dronieapp.com/u/${username}`}</div>
        </div>
      </RouterLink>
    </Card>
  );
}

function PilotPreview({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    let cancel = false;
    supabase.rpc("get_public_pilot", { _pilot_id: id, _is_paid: false })
      .then(({ data }) => { if (!cancel) setData(Array.isArray(data) ? data[0] : data); });
    return () => { cancel = true; };
  }, [id]);
  return (
    <Card className="overflow-hidden">
      <RouterLink to={`/pilots/${id}`} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition">
        <div className="w-14 h-14 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
          <UserIcon className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-primary font-semibold">Pilot Profile</div>
          <div className="font-medium truncate">{data?.display_name ?? "Verified Pilot"}</div>
          <div className="text-xs text-muted-foreground line-clamp-1">{data?.service_area_label ?? "View pilot profile"}</div>
        </div>
      </RouterLink>
    </Card>
  );
}

function GenericLinkPreview({ url }: { url: string }) {
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
  return (
    <Card className="overflow-hidden">
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 hover:bg-muted/50 transition">
        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Link</div>
          <div className="font-medium truncate">{host}</div>
          <div className="text-xs text-muted-foreground truncate">{url}</div>
        </div>
      </a>
    </Card>
  );
}

function PreviewFor({ url }: { url: string }) {
  const yt = youTubeId(url);
  if (yt) return <YouTubePreview id={yt} url={url} />;
  const vm = vimeoId(url);
  if (vm) return <VimeoPreview id={vm} url={url} />;
  const pu = internalPortfolio(url);
  if (pu) return <PortfolioPreview username={pu} />;
  const pi = internalPilot(url);
  if (pi) return <PilotPreview id={pi} />;
  return <GenericLinkPreview url={url} />;
}

export default function LinkPreviews({ text }: { text: string }) {
  const urls = extractUrls(text);
  if (!urls.length) return null;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {urls.map((u) => <PreviewFor key={u} url={u} />)}
    </div>
  );
}