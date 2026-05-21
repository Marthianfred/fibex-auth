import { db } from "./auth";

export type Action =
  | "create"
  | "read"
  | "list"
  | "update"
  | "delete"
  | "ban"
  | "unban"
  | "impersonate"
  | "set-password"
  | "set-role";

export type Resource = "user";

export type PermissionMap = Partial<Record<Resource, Action[]>>;

export interface ResolvedPermissions {
  userId: string;
  role: string | null;
  permissions: PermissionMap;
  isSuperAdmin: boolean;
}

/**
 * Resolves the effective permissions for a user:
 *  1. Loads permissions from their assigned custom_role
 *  2. Applies user_permission_override entries (grant=true adds; grant=false removes)
 *
 * super_admin role short-circuits to allow all actions.
 */
export async function resolvePermissions(userId: string): Promise<ResolvedPermissions> {
  const userResult = await db.query(
    'SELECT id, role FROM "user" WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return { userId, role: null, permissions: {}, isSuperAdmin: false };
  }

  const role: string | null = userResult.rows[0].role || null;

  if (role === "super_admin") {
    return {
      userId,
      role,
      isSuperAdmin: true,
      permissions: {
        user: [
          "create",
          "read",
          "list",
          "update",
          "delete",
          "ban",
          "unban",
          "impersonate",
          "set-password",
          "set-role",
        ],
      },
    };
  }

  let rolePermissions: PermissionMap = {};
  if (role) {
    const roleResult = await db.query(
      "SELECT permissions FROM custom_role WHERE name = $1",
      [role]
    );
    if (roleResult.rows.length > 0) {
      rolePermissions = (roleResult.rows[0].permissions as PermissionMap) || {};
    }
  }

  const overrideResult = await db.query(
    'SELECT resource, action, granted FROM user_permission_override WHERE "userId" = $1',
    [userId]
  );

  const permissions: PermissionMap = {};
  for (const [resource, actions] of Object.entries(rolePermissions)) {
    permissions[resource as Resource] = [...(actions || [])];
  }

  for (const row of overrideResult.rows) {
    const resource = row.resource as Resource;
    const action = row.action as Action;
    const list = (permissions[resource] ||= []);
    const idx = list.indexOf(action);
    if (row.granted) {
      if (idx === -1) list.push(action);
    } else if (idx !== -1) {
      list.splice(idx, 1);
    }
  }

  return { userId, role, permissions, isSuperAdmin: false };
}

export function hasPermission(
  resolved: ResolvedPermissions,
  resource: Resource,
  action: Action
): boolean {
  if (resolved.isSuperAdmin) return true;
  return resolved.permissions[resource]?.includes(action) ?? false;
}
