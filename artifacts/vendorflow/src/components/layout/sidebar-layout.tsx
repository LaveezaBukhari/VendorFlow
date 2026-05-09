import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import {
  Building2,
  LayoutDashboard,
  ShoppingCart,
  Package,
  History,
  Settings,
  Bell,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useListNotifications, useMarkNotificationRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  company_admin: "Company Admin",
  procurement_officer: "Procurement Officer",
  finance_officer: "Finance Officer",
  inventory_manager: "Inventory Manager",
  auditor: "Auditor",
  viewer: "Read-Only Viewer",
  admin: "Admin",
  manager: "Manager",
  user: "User",
};

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, accessToken } = useAuth();
  const [location] = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications } = useListNotifications({ query: { enabled: !!accessToken } });
  const markRead = useMarkNotificationRead();

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {}
    logout();
  };

  const handleMarkRead = (id: number) => {
    markRead.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    });
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/vendors", label: "Vendors", icon: Building2 },
    { href: "/procurement", label: "Procurement", icon: ShoppingCart },
    { href: "/inventory", label: "Inventory", icon: Package },
    { href: "/audit", label: "Audit Logs", icon: History },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const pageLabel = navItems.find(i => location === i.href || location.startsWith(`${i.href}/`))?.label || "VendorFlow";

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r flex flex-col shrink-0">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm shadow shadow-blue-600/30">
              VF
            </div>
            <div>
              <span className="font-bold text-base tracking-tight">VendorFlow</span>
              <div className="text-xs text-sidebar-foreground/40">Enterprise</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "hover:bg-sidebar-accent/40 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "" : "opacity-70"}`} />
                <span className="text-sm">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center font-bold text-sm text-blue-400">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="font-medium text-sm truncate text-sidebar-foreground">{user?.name}</div>
              <div className="text-xs text-sidebar-foreground/50 truncate">
                {ROLE_LABELS[user?.role || ""] || user?.role}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-sidebar-foreground/50 hover:text-destructive w-full px-2 py-1.5 rounded-md transition-colors hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0">
          <div className="font-semibold text-base text-foreground">{pageLabel}</div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setNotifOpen(p => !p)}
                className="relative p-2 text-muted-foreground hover:bg-accent rounded-lg transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-blue-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 bg-card border rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b">
                    <h3 className="font-semibold text-sm">Notifications</h3>
                  </div>
                  {!notifications?.length ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`p-3 border-b last:border-0 hover:bg-muted/30 transition-colors ${!n.read ? "bg-blue-50/50" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${!n.read ? "text-blue-800" : ""}`}>{n.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                          </div>
                          {!n.read && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              className="text-xs text-blue-600 hover:underline shrink-0"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
