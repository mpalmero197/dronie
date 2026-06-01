import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Map, LayoutDashboard, Plane, Briefcase, Layers, Image, Store, Building2,
  Shield, Sparkles, Settings, UserPlus, Compass, Wrench, FileText,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTrack } from "@/hooks/useTrack";

type Cmd = {
  label: string;
  group: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  authOnly?: boolean;
};

const COMMANDS: Cmd[] = [
  { label: "Dashboard", group: "Navigate", to: "/dashboard", icon: LayoutDashboard, authOnly: true },
  { label: "Map viewer", group: "Navigate", to: "/map", icon: Map },
  { label: "Plan a mission", group: "Planning", to: "/plan", icon: Compass, authOnly: true },
  { label: "Saved missions", group: "Planning", to: "/missions", icon: FileText, authOnly: true },
  { label: "Workflow", group: "Planning", to: "/workflow", icon: Sparkles, authOnly: true },
  { label: "Swarm orchestration", group: "Planning", to: "/swarm", icon: Plane, authOnly: true },
  { label: "Reality capture", group: "Planning", to: "/reality", icon: Layers, authOnly: true },
  { label: "RTK alignment", group: "Planning", to: "/rtk", icon: Compass, authOnly: true },
  { label: "Fleet management", group: "Fleet", to: "/fleet", icon: Plane, authOnly: true },
  { label: "Active jobs", group: "Fleet", to: "/jobs", icon: Briefcase, authOnly: true },
  { label: "Compliance", group: "Fleet", to: "/compliance", icon: Shield, authOnly: true },
  { label: "AI insights", group: "Projects", to: "/insights", icon: Sparkles, authOnly: true },
  { label: "Gaussian splats", group: "Projects", to: "/splats", icon: Layers, authOnly: true },
  { label: "Portfolio studio", group: "Portfolio", to: "/portfolio", icon: Image, authOnly: true },
  { label: "Edit a video", group: "Portfolio", to: "/portfolio/edit", icon: Image, authOnly: true },
  { label: "Marketplace", group: "Marketplace", to: "/marketplace", icon: Store },
  { label: "Post a request", group: "Marketplace", to: "/marketplace/new", icon: Store, authOnly: true },
  { label: "Marketplace inbox", group: "Marketplace", to: "/marketplace/inbox", icon: Store, authOnly: true },
  { label: "Find pilots", group: "Marketplace", to: "/pilots", icon: UserPlus },
  { label: "Become a pilot", group: "Pilots", to: "/pilots/join", icon: UserPlus },
  { label: "Pilot verification", group: "Pilots", to: "/pilots/verify", icon: Shield, authOnly: true },
  { label: "Pilot payouts", group: "Pilots", to: "/pilot/payouts", icon: Wrench, authOnly: true },
  { label: "Organizations", group: "Org", to: "/orgs", icon: Building2, authOnly: true },
  { label: "Subscription", group: "Account", to: "/subscription", icon: Settings, authOnly: true },
  { label: "Admin panel", group: "Admin", to: "/admin", icon: Settings, adminOnly: true },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const track = useTrack();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = COMMANDS.filter((c) => {
    if (c.adminOnly && !isAdmin) return false;
    if (c.authOnly && !user) return false;
    return true;
  });

  const groups = Array.from(new Set(visible.map((c) => c.group)));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to anything…  (⌘K)" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {groups.map((g, gi) => (
          <div key={g}>
            {gi > 0 && <CommandSeparator />}
            <CommandGroup heading={g}>
              {visible
                .filter((c) => c.group === g)
                .map((c) => {
                  const Icon = c.icon;
                  return (
                    <CommandItem
                      key={c.to + c.label}
                      value={`${c.group} ${c.label}`}
                      onSelect={() => {
                        setOpen(false);
                        void track("command_palette_navigate", { to: c.to, label: c.label });
                        navigate(c.to);
                      }}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span>{c.label}</span>
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}