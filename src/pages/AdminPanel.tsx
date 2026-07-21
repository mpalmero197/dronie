import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield, ArrowLeft, Loader2, Users, Crown,
  Eye, Plane, ChevronDown, Map, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import VerificationReviews from "@/components/admin/VerificationReviews";
import ApiKeysManager from "@/components/admin/ApiKeysManager";
import AdminRevenuePanel from "@/components/admin/AdminRevenuePanel";
import AdminRequestsPanel from "@/components/admin/AdminRequestsPanel";
import AdminGrowthPanel from "@/components/admin/AdminGrowthPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
  project_count: number;
}

const roleConfig: Record<string, { label: string; icon: typeof Shield; classes: string }> = {
  admin: { label: "Admin", icon: Crown, classes: "bg-accent/15 text-accent border-accent/20" },
  pilot: { label: "Pilot", icon: Plane, classes: "bg-primary/10 text-primary border-primary/20" },
  viewer: { label: "Viewer", icon: Eye, classes: "bg-muted text-muted-foreground border-border" },
};

function RoleBadge({ role }: { role: string }) {
  const cfg = roleConfig[role] || roleConfig.viewer;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.classes}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export default function AdminPanel() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate("/dashboard");
    }
  }, [authLoading, user, isAdmin, navigate]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-users`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load users");
      }
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user && isAdmin) fetchUsers();
  }, [user, isAdmin]);

  async function setUserRole(targetUserId: string, role: string) {
    setUpdatingId(targetUserId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "set_role", user_id: targetUserId, role }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update role");
      }

      setUsers((prev) =>
        prev.map((u) => u.id === targetUserId ? { ...u, roles: [role] } : u)
      );
      toast({ title: "Role updated", description: `User set to ${role}.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
                <Shield className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h1 className="font-display font-700 text-foreground">User Management</h1>
                <p className="text-xs text-muted-foreground">
                  {users.length} user{users.length !== 1 ? "s" : ""} registered
                </p>
              </div>
            </div>
          </div>
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Map className="w-3.5 h-3.5" />
              Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: users.length, icon: Users, color: "text-primary", bg: "bg-secondary" },
            { label: "Admins", value: users.filter((u) => u.roles.includes("admin")).length, icon: Crown, color: "text-accent", bg: "bg-accent/10" },
            { label: "Pilots", value: users.filter((u) => u.roles.includes("pilot")).length, icon: Plane, color: "text-primary", bg: "bg-primary/10" },
            { label: "Viewers", value: users.filter((u) => u.roles.includes("viewer")).length, icon: Eye, color: "text-muted-foreground", bg: "bg-muted" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card rounded-xl p-4 border border-border flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xl font-display font-700 text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* User list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Header — desktop only */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>User</span>
              <span className="text-center w-20">Projects</span>
              <span className="text-center w-24">Role</span>
              <span className="text-center w-32">Actions</span>
            </div>

            {users.map((u) => {
              const primaryRole = u.roles.includes("admin") ? "admin" : u.roles.includes("pilot") ? "pilot" : "viewer";
              const isSelf = u.id === user?.id;

              return (
                <div
                  key={u.id}
                  className="flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:gap-4 sm:items-center px-4 sm:px-5 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {/* User info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground break-all sm:truncate">
                        {u.full_name || "Unnamed User"}
                      </p>
                      {isSelf && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium flex-shrink-0">You</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground break-all sm:truncate">{u.email}</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      Joined {new Date(u.created_at).toLocaleDateString()}
                      {u.last_sign_in_at && ` · Last seen ${new Date(u.last_sign_in_at).toLocaleDateString()}`}
                    </p>
                  </div>

                  {/* Mobile meta row: role + projects inline */}
                  <div className="flex items-center justify-between gap-2 sm:hidden">
                    <div className="flex items-center gap-2">
                      <RoleBadge role={primaryRole} />
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <FolderOpen className="w-3 h-3" />
                        {u.project_count} {u.project_count === 1 ? "project" : "projects"}
                      </span>
                    </div>
                  </div>

                  {/* Desktop: Projects */}
                  <div className="hidden sm:block text-center w-20">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <FolderOpen className="w-3 h-3" />
                      {u.project_count}
                    </span>
                  </div>

                  {/* Desktop: Current role */}
                  <div className="hidden sm:block text-center w-24">
                    <RoleBadge role={primaryRole} />
                  </div>

                  {/* Actions */}
                  <div className="sm:text-center sm:w-32">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingId === u.id || isSelf}
                          className="gap-1.5 text-xs w-full sm:w-auto"
                        >
                          {updatingId === u.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              Change Role
                              <ChevronDown className="w-3 h-3" />
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {(["admin", "pilot", "viewer"] as const).map((role) => {
                          const cfg = roleConfig[role];
                          const Icon = cfg.icon;
                          const isCurrentRole = primaryRole === role;
                          return (
                            <DropdownMenuItem
                              key={role}
                              disabled={isCurrentRole}
                              className={`gap-2 cursor-pointer ${isCurrentRole ? "opacity-50" : ""}`}
                              onClick={() => setUserRole(u.id, role)}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {cfg.label}
                              {isCurrentRole && <span className="ml-auto text-xs text-muted-foreground">Current</span>}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}

            {users.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No users found.
              </div>
            )}
          </div>
        )}

        <Tabs defaultValue="revenue" className="w-full">
          <TabsList className="grid w-full grid-cols-5 max-w-3xl">
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="growth">Growth</TabsTrigger>
            <TabsTrigger value="verifications">Verifications</TabsTrigger>
            <TabsTrigger value="api">API Keys</TabsTrigger>
          </TabsList>
          <TabsContent value="revenue" className="mt-4">
            <AdminRevenuePanel />
          </TabsContent>
          <TabsContent value="requests" className="mt-4">
            <AdminRequestsPanel />
          </TabsContent>
          <TabsContent value="growth" className="mt-4">
            <AdminGrowthPanel />
          </TabsContent>
          <TabsContent value="verifications" className="mt-4">
            <VerificationReviews />
          </TabsContent>
          <TabsContent value="api" className="mt-4">
            <ApiKeysManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
