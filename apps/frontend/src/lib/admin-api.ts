import { authClient as rawClient } from './auth-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = rawClient as any;

export const adminApi = {
  listUsers: (opts: { query: { limit: string; offset: string } }) => api.admin.listUsers(opts),
  getUser: (opts: { query: { userId: string } }) => api.admin.getUser(opts),
  createUser: (opts: { body: { name: string; email: string; password: string; role?: string } }) => api.admin.createUser(opts),
  updateUser: (opts: { body: Record<string, string> }) => api.admin.updateUser(opts),
  setRole: (opts: { body: { userId: string; role: string } }) => api.admin.setRole(opts),
  banUser: (opts: { body: { userId: string; banReason?: string } }) => api.admin.banUser(opts),
  unbanUser: (opts: { body: { userId: string } }) => api.admin.unbanUser(opts),
  removeUser: (opts: { body: { userId: string } }) => api.admin.removeUser(opts),
  setUserPassword: (opts: { body: { userId: string; newPassword: string } }) => api.admin.setUserPassword(opts),
  impersonateUser: (opts: { body: { userId: string } }) => api.admin.impersonateUser(opts),
  listUserSessions: (opts: { query: { userId: string } }) => api.admin.listUserSessions(opts),
  revokeUserSession: (opts: { body: { userId: string; token: string } }) => api.admin.revokeUserSession(opts),
  revokeUserSessions: (opts: { body: { userId: string } }) => api.admin.revokeUserSessions(opts),
};

export const dashboardApi = {
  getEndpoints: () => api.dashboardGetEndpoints(),
};
