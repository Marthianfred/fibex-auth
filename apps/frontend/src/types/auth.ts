export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  role?: string;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: string | Date | null;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
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
