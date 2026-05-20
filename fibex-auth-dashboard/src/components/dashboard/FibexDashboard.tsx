import { useState, useEffect, useCallback } from "react";
import * as UI from "../ui/DashboardComponents";
import {
  Home,
  Users,
  ShieldCheck,
  Settings,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { authClient } from "../../lib/auth-client";
import { HomePage } from "../pages/HomePage";
import { UsersPage } from "../pages/UsersPage";
import { UserDetailPage } from "../pages/UserDetailPage";
import { RouteProtectionPage } from "../pages/RouteProtectionPage";
import { SettingsPage } from "../pages/SettingsPage";

type SidebarItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  subItems?: { title: string; url: string; icon: LucideIcon }[];
};

const basePath = "/dashboard";

const sidebarItems: SidebarItem[] = [
  { title: "Home", url: basePath, icon: Home },
  {
    title: "Users",
    url: `${basePath}/users`,
    icon: Users,
  },
  {
    title: "Route Protection",
    url: `${basePath}/route-protection`,
    icon: ShieldCheck,
  },
  {
    title: "Settings",
    url: `${basePath}/settings`,
    icon: Settings,
  },
];

function matchRoute(pathname: string): {
  page: string;
  params: Record<string, string>;
} {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 1 && parts[0] === "dashboard") {
    return { page: "home", params: {} };
  }

  if (parts.length >= 2 && parts[0] === "dashboard") {
    const subpath = parts[1];

    if (subpath === "users") {
      if (parts.length === 3) {
        return { page: "user-detail", params: { userId: parts[2] } };
      }
      return { page: "users", params: {} };
    }
    if (subpath === "route-protection") {
      return { page: "route-protection", params: {} };
    }
    if (subpath === "settings") {
      return { page: "settings", params: {} };
    }
  }

  return { page: "home", params: {} };
}

function useLocationChange(callback: () => void) {
  useEffect(() => {
    window.addEventListener("popstate", callback);
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      callback();
    };
    return () => {
      window.removeEventListener("popstate", callback);
    };
  }, [callback]);
}

export function FibexDashboard() {
  const [pathname, setPathname] = useState(
    () => window.location.pathname
  );

  const handleLocationChange = useCallback(() => {
    setPathname(window.location.pathname);
  }, []);

  useLocationChange(handleLocationChange);

  const session = authClient.useSession();
  const currentUser = session.data?.user;

  const { page, params } = matchRoute(pathname);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const getActiveState = (itemUrl: string) => {
    return pathname === itemUrl || (itemUrl !== basePath && pathname.startsWith(itemUrl));
  };

  const navigate = (url: string) => {
    window.history.pushState(null, "", url);
    setPathname(url);
  };

  return (
    <UI.TooltipProvider>
      <UI.SidebarProvider>
        {/* Sidebar */}
        <UI.Sidebar>
          <UI.SidebarContent>
            <div className="px-4 py-5 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">FIBEX Auth</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Dashboard</div>
                </div>
              </div>
            </div>

            <UI.SidebarGroup>
              <UI.SidebarGroupLabel>Admin Dashboard</UI.SidebarGroupLabel>
              <UI.SidebarGroupContent>
                <UI.SidebarMenu>
                  {sidebarItems.map((item) => {
                    if (!item.subItems || item.subItems.length === 0) {
                      return (
                        <UI.SidebarMenuItem key={item.url}>
                          <UI.SidebarMenuButton
                            asChild
                            isActive={getActiveState(item.url)}
                            onClick={() => navigate(item.url)}
                          >
                            <div>
                              <item.icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </div>
                          </UI.SidebarMenuButton>
                        </UI.SidebarMenuItem>
                      );
                    }
                    return (
                      <div key={item.url}>
                        <UI.Collapsible
                          open={collapsed[item.url]}
                          onOpenChange={(open) =>
                            setCollapsed((prev) => ({ ...prev, [item.url]: open }))
                          }
                        >
                          <UI.SidebarGroupLabel asChild className="cursor-pointer">
                            <UI.CollapsibleTrigger>
                              <div className="flex items-center gap-2 w-full text-sm">
                                <item.icon className="w-4 h-4" />
                                <span>{item.title}</span>
                                <ChevronRight
                                  className={cn(
                                    "ml-auto w-4 h-4 transition-transform",
                                    collapsed[item.url] ? "rotate-90" : ""
                                  )}
                                />
                              </div>
                            </UI.CollapsibleTrigger>
                          </UI.SidebarGroupLabel>
                          <UI.CollapsibleContent>
                            <UI.SidebarGroupContent>
                              <UI.SidebarMenu>
                                {item.subItems.map((sub) => (
                                  <UI.SidebarMenuItem key={sub.url}>
                                    <UI.SidebarMenuButton
                                      asChild
                                      isActive={getActiveState(sub.url)}
                                      onClick={() => navigate(sub.url)}
                                    >
                                      <div className="pl-6">
                                        <sub.icon className="w-4 h-4" />
                                        <span>{sub.title}</span>
                                      </div>
                                    </UI.SidebarMenuButton>
                                  </UI.SidebarMenuItem>
                                ))}
                              </UI.SidebarMenu>
                            </UI.SidebarGroupContent>
                          </UI.CollapsibleContent>
                        </UI.Collapsible>
                      </div>
                    );
                  })}
                </UI.SidebarMenu>
              </UI.SidebarGroupContent>
            </UI.SidebarGroup>
          </UI.SidebarContent>

          {/* Sidebar Footer */}
          <div className="mt-auto border-t border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                {currentUser?.name?.charAt(0)?.toUpperCase() || currentUser?.email?.charAt(0)?.toUpperCase() || "A"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">
                  {currentUser?.name || currentUser?.email || "Not signed in"}
                </div>
                <div className="text-[10px] text-gray-500">{(currentUser as Record<string, unknown>)?.role as string || "—"}</div>
              </div>
            </div>
          </div>
        </UI.Sidebar>

        {/* Main Content */}
        <main className="flex-1 bg-gray-50 min-h-screen">
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
            <UI.SidebarTrigger />
            <div className="text-sm text-gray-500">
              {pathname === basePath && "Home"}
              {pathname.startsWith(`${basePath}/users`) && "Users"}
              {pathname.startsWith(`${basePath}/route-protection`) && "Route Protection"}
              {pathname.startsWith(`${basePath}/settings`) && "Settings"}
            </div>
          </div>

          {page === "home" && <HomePage />}
          {page === "users" && <UsersPage />}
          {page === "user-detail" && <UserDetailPage userId={params.userId} />}
          {page === "route-protection" && <RouteProtectionPage />}
          {page === "settings" && <SettingsPage />}
        </main>
      </UI.SidebarProvider>
    </UI.TooltipProvider>
  );
}
