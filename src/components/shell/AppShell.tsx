import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon, Zap, Shield } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import NotificationBell from "@/components/NotificationBell";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { getTierLimits } from "@/lib/subscription-limits";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function AppShell({ title, subtitle, actions, children }: Props) {
  const navigate = useNavigate();
  const { user, isAdmin, isSubscribed, subscriptionTier, signOut } = useAuth();
  const tier = getTierLimits(subscriptionTier, isAdmin);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 h-14 flex items-center gap-2 border-b border-border bg-card/95 backdrop-blur-md px-3 sm:px-5">
            <SidebarTrigger className="text-muted-foreground" />
            <div className="min-w-0 flex-1 ml-1">
              <h1 className="font-display font-700 text-foreground text-sm sm:text-base leading-tight truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[11px] text-muted-foreground truncate leading-tight">{subtitle}</p>
              )}
            </div>

            {actions && <div className="flex items-center gap-2">{actions}</div>}

            <div className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isSubscribed ? "bg-accent/15 text-accent border-accent/25" : "bg-secondary text-muted-foreground border-border"
            }`}>
              <Zap className="w-3 h-3" />
              {tier.tierLabel}
            </div>

            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-9 h-9 rounded-full bg-primary flex items-center justify-center overflow-hidden ring-2 ring-transparent hover:ring-primary/40 transition">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-primary-foreground" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-sm truncate">{user?.user_metadata?.full_name || "Pilot"}</span>
                  <span className="text-xs text-muted-foreground truncate font-normal">{user?.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate("/portfolio")}>
                  <UserIcon className="w-3.5 h-3.5" /> Profile & Portfolio
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate("/subscription")}>
                  <Zap className="w-3.5 h-3.5" /> Subscription
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate("/admin")}>
                    <Shield className="w-3.5 h-3.5" /> Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                  onClick={async () => { await signOut(); navigate("/"); }}
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 min-w-0 overflow-x-hidden">
            <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}