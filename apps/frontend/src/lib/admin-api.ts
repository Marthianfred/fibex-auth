// Helper for same-origin admin API calls (proxied to backend via nginx)
async function apiFetch<T = any>(
  path: string,
  init?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...init,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { data: null, error: body.error || res.statusText };
    }
    const data = (await res.json()) as T;
    return { data, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message || "Network error" };
  }
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
  updatedAt: string;
  emailVerified: boolean;
  allowedApps: string;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionOverride {
  id: string;
  resource: string;
  action: string;
  granted: boolean;
  createdAt: string;
}

export interface MyPermissions {
  userId: string;
  role: string | null;
  permissions: Record<string, string[]>;
  isSuperAdmin: boolean;
}

// ---------------- Users ----------------
export const adminApi = {
  listUsers: (opts: { query: { limit?: string | number; offset?: string | number; search?: string } }) => {
    const params = new URLSearchParams();
    if (opts.query.limit !== undefined) params.set("limit", String(opts.query.limit));
    if (opts.query.offset !== undefined) params.set("offset", String(opts.query.offset));
    if (opts.query.search) params.set("search", opts.query.search);
    return apiFetch<{ users: AdminUser[]; total: number; limit: number; offset: number }>(
      `/api/admin/users?${params.toString()}`
    );
  },

  getUser: (opts: { query: { userId: string } }) =>
    apiFetch<{ user: AdminUser }>(`/api/admin/users/${opts.query.userId}`),

  createUser: (opts: { body: { name: string; email: string; password: string; role?: string } }) =>
    apiFetch(`/api/admin/users`, { method: "POST", body: JSON.stringify(opts.body) }),

  updateUser: (opts: { body: Record<string, any> }) => {
    const { userId, ...data } = opts.body;
    return apiFetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  setRole: (opts: { body: { userId: string; role: string } }) =>
    apiFetch(`/api/admin/users/${opts.body.userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role: opts.body.role }),
    }),

  banUser: (opts: { body: { userId: string; banReason?: string } }) =>
    apiFetch(`/api/admin/users/${opts.body.userId}/ban`, {
      method: "POST",
      body: JSON.stringify({ banReason: opts.body.banReason }),
    }),

  unbanUser: (opts: { body: { userId: string } }) =>
    apiFetch(`/api/admin/users/${opts.body.userId}/unban`, { method: "POST" }),

  removeUser: (opts: { body: { userId: string } }) =>
    apiFetch(`/api/admin/users/${opts.body.userId}`, { method: "DELETE" }),

  // The following are not exposed by the custom endpoints yet; stub them.
  setUserPassword: async (_opts: { body: { userId: string; newPassword: string } }) => ({
    data: null,
    error: "Not implemented in custom admin API",
  }),
  impersonateUser: async (_opts: { body: { userId: string } }) => ({
    data: null,
    error: "Not implemented in custom admin API",
  }),
  listUserSessions: async (_opts: { query: { userId: string } }) => ({
    data: { sessions: [] },
    error: null,
  }),
  revokeUserSession: async (_opts: { body: { userId: string; token: string } }) => ({
    data: null,
    error: "Not implemented in custom admin API",
  }),
  revokeUserSessions: async (_opts: { body: { userId: string } }) => ({
    data: null,
    error: "Not implemented in custom admin API",
  }),
};

// ---------------- Custom Roles ----------------
export const rolesApi = {
  list: () => apiFetch<{ roles: CustomRole[] }>(`/api/admin/custom-roles`),
  create: (body: { name: string; description?: string; permissions: Record<string, string[]> }) =>
    apiFetch<{ role: CustomRole }>(`/api/admin/custom-roles`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<{ name: string; description: string; permissions: Record<string, string[]> }>) =>
    apiFetch<{ role: CustomRole }>(`/api/admin/custom-roles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<{ deleted: string }>(`/api/admin/custom-roles/${id}`, { method: "DELETE" }),
};

// ---------------- Permission Overrides ----------------
export const overridesApi = {
  list: (userId: string) =>
    apiFetch<{ overrides: PermissionOverride[] }>(`/api/admin/users/${userId}/overrides`),
  upsert: (userId: string, body: { resource: string; action: string; granted: boolean }) =>
    apiFetch<{ override: PermissionOverride }>(`/api/admin/users/${userId}/overrides`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  remove: (userId: string, overrideId: string) =>
    apiFetch<{ deleted: string }>(`/api/admin/users/${userId}/overrides/${overrideId}`, {
      method: "DELETE",
    }),
};

// ---------------- My Permissions ----------------
export const meApi = {
  getPermissions: () => apiFetch<MyPermissions>(`/api/admin/me/permissions`),
};

// Dashboard endpoints stub (legacy)
export const dashboardApi = {
  getEndpoints: async (): Promise<{ data: { paths: string[] } | null; error: null }> => ({
    data: { paths: [] },
    error: null,
  }),
};
