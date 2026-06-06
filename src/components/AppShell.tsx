import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Building2, Tags, FileUp, Settings, Sparkles, ListChecks, Wand2, Download, BarChart3, KanbanSquare, Megaphone, Mail, ShieldOff, Cog, Plug, RefreshCw } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/businesses", label: "Businesses", icon: Building2 },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Import & Map",
    items: [
      { to: "/imports", label: "Imports", icon: FileUp },
      { to: "/mapping-templates", label: "Mapping templates", icon: ListChecks },
      { to: "/categories", label: "Categories", icon: Tags },
    ],
  },
  {
    label: "Clean & Enrich",
    items: [
      { to: "/data-cleanup", label: "Data cleanup", icon: Wand2 },
    ],
  },
  {
    label: "Score & Segment",
    items: [
      { to: "/export-center", label: "Export center", icon: Download },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
    ],
  },
  {
    label: "Campaign & Send",
    items: [
      { to: "/campaigns", label: "Campaigns", icon: Megaphone },
      { to: "/email-accounts", label: "Email accounts", icon: Mail },
      { to: "/email-settings", label: "Email settings", icon: Cog },
      { to: "/suppression-list", label: "Suppression list", icon: ShieldOff },
    ],
  },
  {
    label: "Sync",
    items: [
      { to: "/integrations", label: "Integrations", icon: Plug },
      { to: "/sync-center", label: "Sync center", icon: RefreshCw },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AppShell({ children, title, action }: { children: ReactNode; title: string; action?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground h-screen overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold leading-tight">LeadForge</div>
            <div className="text-xs text-sidebar-foreground/60">Maps Lead Processor</div>
          </div>
        </div>
        <nav className="flex-1 min-h-0 px-3 py-4 space-y-4 overflow-hidden">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-6 py-4 text-xs text-sidebar-foreground/60 shrink-0">
          v0.2 · Auto-detect MVP
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 shrink-0 border-b bg-card/60 backdrop-blur flex items-center justify-between px-6 z-20">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <div className="flex items-center gap-2">{action}</div>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
