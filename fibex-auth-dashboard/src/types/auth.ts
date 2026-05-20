export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  role?: string;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: string | null;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface RouteProtection {
  route: string;
  isRoleProtected: boolean;
  roleProtection: string;
  isAuthenticatedProtected: boolean;
}

export interface ListUsersResponse {
  users: AuthUser[];
  total: number;
  offset?: number;
  limit?: number;
}

export interface GetUserResponse {
  user: AuthUser;
}
