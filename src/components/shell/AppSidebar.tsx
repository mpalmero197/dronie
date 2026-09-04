import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FolderOpen, Map as MapIcon, Plane, Briefcase, Boxes,
  Sparkles, Video, Camera, MessagesSquare, CreditCard, Shield, Radar,
  Satellite, Brain, ShieldCheck, Radio, Workflow as WorkflowIcon, Users, Bookmark,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

type Item = { title: string; url: string; icon: any };

const workspace: Item[] = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", url: "/dashboard?view=projects", icon: FolderOpen },
  { title: "Missions", url: "/missions", icon: Bookmark },
  { title: "Map", url: "/map", icon: MapIcon },
  { title: "Fleet", url: "/fleet", icon: Plane },
  { title: "Workflow", url: "/workflow", icon: WorkflowIcon },
];

const advanced: Item[] = [
  { title: "Swarm Ops", url: "/swarm", icon: Boxes },
  { title: "Reality Capture", url: "/reality", icon: Radar },
  { title: "RTK / GCP", url: "/rtk", icon: Satellite },
  { title: "AI Insights", url: "/insights", icon: Brain },
  { title: "Splats", url: "/splats", icon: Sparkles },
  { title: "Compliance", url: "/compliance", icon: ShieldCheck },
  { title: "Data Services", url: "/adsp", icon: Radio },
];

const network: Item[] = [
  { title: "Marketplace", url: "/marketplace", icon: Briefcase },
  { title: "Pilot Dashboard", url: "/pilots/dashboard", icon: Plane },
  { title: "Portfolio", url: "/portfolio", icon: Camera },
  { title: "Video Editor", url: "/portfolio/edit", icon: Video },
  { title: "Community", url: "/community", icon: MessagesSquare },
  { title: "Organizations", url: "/orgs", icon: Users },
];

export default function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname, search } = useLocation();
  const { isAdmin } = useAuth();
  const current = pathname + search;

  const isActive = (url: string) => {
    if (url.includes("?")) return current === url;
    if (url === "/dashboard") return pathname === "/dashboard" && !search.includes("view=");
    return pathname === url || pathname.startsWith(url + "/");
  };

  const renderGroup = (label: string, items: Item[]) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <NavLink to={item.url} end={item.url === "/dashboard"} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <NavLink to="/" className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow flex-shrink-0">
            <MapIcon className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-display font-700 text-sidebar-foreground">Dronie</span>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("Workspace", workspace)}
        {renderGroup("Modules", advanced)}
        {renderGroup("Network", network)}

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Account</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/subscription")} tooltip="Subscription">
                  <NavLink to="/subscription" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {!collapsed && <span>Subscription</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin")} tooltip="Admin">
                    <NavLink to="/admin" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {!collapsed && <span>Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}