import { useState } from "react";
import { authClient } from "../../lib/auth-client";
import { Globe, Shield } from "lucide-react";

export function SettingsPage() {
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
      setSigningOut(false);
    }
  };

  const session = authClient.useSession();
  const user = session.data?.user as Record<string, unknown> | undefined;

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your dashboard configuration</p>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Session</h3>
              <p className="text-sm text-gray-500">Current authentication session details</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">User</span>
              <span className="text-gray-900 font-medium">
                {user?.name as string || user?.email as string || "N/A"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Role</span>
              <span className="text-gray-900 font-medium">
                {user?.role as string || "N/A"}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Status</span>
              <span className="text-green-600 font-medium">
                {session.isPending ? "Loading..." : "Active"}
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-4 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg disabled:opacity-50"
          >
            {signingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Globe className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Server</h3>
              <p className="text-sm text-gray-500">Better Auth server connection details</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Endpoint</span>
              <span className="text-gray-900 font-mono text-xs">
                https://better-auth-server-production-76d3.up.railway.app
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Plugin</span>
              <span className="text-green-600 font-medium">better-auth-dashboard</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
