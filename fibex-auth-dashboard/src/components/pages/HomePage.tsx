import { useState, useEffect } from "react";
import { authClient } from "../../lib/auth-client";
import { adminApi, dashboardApi } from "../../lib/admin-api";
import { Users, Shield, Activity, Server, ArrowRight, type LucideIcon } from "lucide-react";
import { useNavigate } from "./useNavigate";

export function HomePage() {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [routeCount, setRouteCount] = useState<number | null>(null);
  const navigate = useNavigate();
  const session = authClient.useSession();

  useEffect(() => {
    adminApi.listUsers({ query: { limit: "1", offset: "0" } })
      .then((res: { data?: { total: number }; error?: { message: string } }) => { if (res.data?.total !== undefined) setUserCount(res.data.total); })
      .catch(() => {});

    dashboardApi.getEndpoints()
      .then((res: { data?: { paths?: string[] } | Array<unknown>; error?: { message: string } }) => {
        const data = res.data;
        if (data && !Array.isArray(data) && data.paths) setRouteCount(data.paths.length);
        else if (Array.isArray(data)) setRouteCount(data.length);
      })
      .catch(() => {});
  }, []);

  const stats = [
    { label: "Total Users", value: userCount ?? "—", icon: Users, href: "/dashboard/users" },
    { label: "API Routes", value: routeCount ?? "—", icon: Server, href: "/dashboard/route-protection" },
    { label: "Session", value: session?.data ? "Active" : "—", icon: Activity, href: "#" },
    { label: "Auth Status", value: session?.data ? "Authenticated" : "Loading...", icon: Shield, href: "#" },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600",
    orange: "bg-orange-100 text-orange-600",
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back{", "}
          {(session?.data?.user as Record<string, unknown> | undefined)?.name as string || (session?.data?.user as Record<string, unknown> | undefined)?.email as string || "Admin"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-sm transition-shadow cursor-pointer"
            onClick={() => stat.href !== "#" && navigate(stat.href)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={"w-10 h-10 rounded-lg flex items-center justify-center " + (colorMap[stat.href] ? "" : "bg-gray-100")}>
                <stat.icon className={"w-5 h-5 text-gray-600"} />
              </div>
              {stat.href !== "#" && (
                <ArrowRight className="w-4 h-4 text-gray-300" />
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickActionCard
          title="User Management"
          description="View, create, edit, and manage all users in the system"
          icon={Users}
          navigate={() => navigate("/dashboard/users")}
        />
        <QuickActionCard
          title="Route Protection"
          description="Configure authentication and role-based access for API routes"
          icon={Shield}
          navigate={() => navigate("/dashboard/route-protection")}
        />
      </div>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
  navigate,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  navigate: () => void;
}) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
      onClick={navigate}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 flex-shrink-0 mt-1" />
      </div>
    </div>
  );
}
