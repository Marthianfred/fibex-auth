import { useState, useEffect, useCallback } from "react";
import { dashboardApi } from "../../lib/admin-api";
import { Shield, RefreshCw } from "lucide-react";

export function RouteProtectionPage() {
  const [routes, setRoutes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.getEndpoints();
      if (res.data?.paths) {
        setRoutes(res.data.paths);
      } else if (Array.isArray(res.data)) {
        setRoutes(res.data);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch route data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Route Protection</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure authentication and role-based access for API routes
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{routes.length}</div>
              <div className="text-sm text-gray-500">Total Routes</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{routes.filter(r => r.startsWith("/api/auth")).length}</div>
              <div className="text-sm text-gray-500">Auth Routes</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{routes.filter(r => !r.startsWith("/api/auth")).length}</div>
              <div className="text-sm text-gray-500">Other Routes</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Registered Routes</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {routes.map((route) => (
                <div key={route} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-mono text-gray-700">{route}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      Public
                    </span>
                  </div>
                </div>
              ))}
              {routes.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-500">
                  No routes found. The server admin must be logged in to view routes.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
