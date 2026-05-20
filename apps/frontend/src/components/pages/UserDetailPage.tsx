import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../../lib/admin-api";
import { ArrowLeft, Shield, Ban, RefreshCw, Key, Trash2, Clock, Globe, Monitor } from "lucide-react";
import { cn } from "../../lib/utils";
import { useNavigate } from "./useNavigate";
import type { AuthUser, AuthSession } from "../../types/auth";

interface Props {
  userId: string;
}

export function UserDetailPage({ userId }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchUserData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userRes, sessionsRes] = await Promise.all([
        adminApi.getUser({ query: { userId } }),
        adminApi.listUserSessions({ query: { userId } }),
      ]);
      if (userRes.data) setUser((userRes.data as any).user || userRes.data);
      if (sessionsRes.data) setSessions((sessionsRes.data as any).sessions || sessionsRes.data || []);
      if (userRes.error) setError(userRes.error.message || "Failed to fetch user");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch user data");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUserData();
  }, [fetchUserData]);

  const handleBanToggle = async () => {
    if (!user) return;
    try {
      if (user.banned) {
        await adminApi.unbanUser({ body: { userId: user.id } });
      } else {
        await adminApi.banUser({ body: { userId: user.id, banReason: "Banned by admin" } });
      }
      fetchUserData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update user");
    }
  };

  const handleRevokeSession = async (token: string) => {
    try {
      await adminApi.revokeUserSession({ body: { userId: user!.id, token } });
      fetchUserData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to revoke session");
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!confirm("Revoke all sessions for this user?")) return;
    try {
      await adminApi.revokeUserSessions({ body: { userId: user!.id } });
      fetchUserData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to revoke sessions");
    }
  };

  const handleImpersonate = async () => {
    try {
      const res = await adminApi.impersonateUser({ body: { userId: user!.id } });
      const data = res.data as any;
      if (data?.url) window.location.href = data.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to impersonate user");
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 py-12">User not found</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button
        onClick={() => navigate("/dashboard/users")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Users
      </button>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-blue-600">
                  {user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{user.name || "N/A"}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                  user.banned ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                )}>
                  {user.banned ? "Banned" : "Active"}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {user.role || "user"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">ID</span>
                <span className="text-gray-900 font-mono text-xs truncate max-w-[180px]">{user.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Email Verified</span>
                <span className={user.emailVerified ? "text-green-600" : "text-red-600"}>
                  {user.emailVerified ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900">{new Date(user.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Updated</span>
                <span className="text-gray-900">{new Date(user.updatedAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button
                onClick={handleBanToggle}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                  user.banned
                    ? "bg-green-50 text-green-700 hover:bg-green-100"
                    : "bg-orange-50 text-orange-700 hover:bg-orange-100"
                )}
              >
                <Ban className="w-4 h-4" />
                {user.banned ? "Unban User" : "Ban User"}
              </button>
              <button
                onClick={handleImpersonate}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium"
              >
                <Shield className="w-4 h-4" />
                Impersonate User
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Active Sessions</h3>
                <p className="text-sm text-gray-500">{sessions.length} session(s)</p>
              </div>
              {sessions.length > 0 && (
                <button
                  onClick={handleRevokeAllSessions}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Revoke All
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {sessions.map((session) => (
                <div key={session.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <Monitor className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-500 truncate max-w-[200px]">
                          {session.token?.substring(0, 16)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(session.createdAt).toLocaleString()}
                        </span>
                        {session.ipAddress && (
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {session.ipAddress}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeSession(session.token)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Revoke session"
                  >
                    <Key className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-500 text-sm">
                  No active sessions
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
