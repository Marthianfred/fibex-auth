import { authClient } from './auth-client';

export const adminApi = {
  listUsers: (opts: { query: { limit: string; offset: string } }) => authClient.admin.listUsers(opts),
  getUser: (opts: { query: { userId: string } }) => authClient.admin.getUser({ query: { id: opts.query.userId } }),
  createUser: (opts: { body: { name: string; email: string; password: string; role?: string } }) => authClient.admin.createUser({
    email: opts.body.email,
    name: opts.body.name,
    password: opts.body.password,
    role: opts.body.role as any
  }),
  updateUser: (opts: { body: Record<string, any> }) => {
    const { userId, ...data } = opts.body;
    return authClient.admin.updateUser({ userId, data });
  },
  setRole: (opts: { body: { userId: string; role: string } }) => authClient.admin.setRole({
    userId: opts.body.userId,
    role: opts.body.role as any
  }),
  banUser: (opts: { body: { userId: string; banReason?: string } }) => authClient.admin.banUser({
    userId: opts.body.userId,
    banReason: opts.body.banReason
  }),
  unbanUser: (opts: { body: { userId: string } }) => authClient.admin.unbanUser({
    userId: opts.body.userId
  }),
  removeUser: (opts: { body: { userId: string } }) => authClient.admin.removeUser({
    userId: opts.body.userId
  }),
  setUserPassword: (opts: { body: { userId: string; newPassword: string } }) => authClient.admin.setUserPassword({
    userId: opts.body.userId,
    newPassword: opts.body.newPassword
  }),
  impersonateUser: (opts: { body: { userId: string } }) => authClient.admin.impersonateUser({
    userId: opts.body.userId
  }),
  listUserSessions: (opts: { query: { userId: string } }) => authClient.admin.listUserSessions({
    userId: opts.query.userId
  }),
  revokeUserSession: (opts: { body: { userId: string; token: string } }) => authClient.admin.revokeUserSession({
    sessionToken: opts.body.token
  }),
  revokeUserSessions: (opts: { body: { userId: string } }) => authClient.admin.revokeUserSessions({
    userId: opts.body.userId
  }),
};

export const dashboardApi = {
  getEndpoints: async () => ({ data: [], error: null }),
};
