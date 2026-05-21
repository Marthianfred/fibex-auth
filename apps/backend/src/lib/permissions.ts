import { db } from "./db";

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

export type QueryFn = (
	sql: string,
	params?: any[]
) => Promise<{ rows: any[] }>;

const SUPER_ADMIN_PERMISSIONS: PermissionMap = {
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
};

/**
 * Resolves effective permissions for a user.
 * Pure: takes a query function so it can be tested without a DB.
 *
 *   1. Fetch user role from "user" table
 *   2. If role is "super_admin", short-circuit to all permissions
 *   3. Fetch role permissions from custom_role table
 *   4. Apply overrides from user_permission_override table
 */
export async function resolvePermissionsWith(
	query: QueryFn,
	userId: string
): Promise<ResolvedPermissions> {
	const userResult = await query(
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
				user: [...(SUPER_ADMIN_PERMISSIONS.user || [])],
			},
		};
	}

	let rolePermissions: PermissionMap = {};
	if (role) {
		const roleResult = await query(
			"SELECT permissions FROM custom_role WHERE name = $1",
			[role]
		);
		if (roleResult.rows.length > 0) {
			rolePermissions = (roleResult.rows[0].permissions as PermissionMap) || {};
		}
	}

	const overrideResult = await query(
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

/**
 * Production wrapper using the real DB pool.
 */
export async function resolvePermissions(
	userId: string
): Promise<ResolvedPermissions> {
	return resolvePermissionsWith(
		(sql, params) => db.query(sql, params),
		userId
	);
}

export function hasPermission(
	resolved: ResolvedPermissions,
	resource: Resource,
	action: Action
): boolean {
	if (resolved.isSuperAdmin) return true;
	return resolved.permissions[resource]?.includes(action) ?? false;
}
