import { describe, test, expect } from "bun:test";
import {
	resolvePermissionsWith,
	hasPermission,
	type QueryFn,
} from "../src/lib/permissions";

// ---------- fixtures ----------
const ROLE_VIEWER_ROW = {
	permissions: { user: ["read", "list"] },
};

const ROLE_EDITOR_ROW = {
	permissions: { user: ["read", "list", "update"] },
};

// ---------- helpers ----------
function makeQuery(
	handlers: Array<(sql: string, params?: any[]) => { rows: any[] } | undefined>
): QueryFn {
	let i = 0;
	return async (sql, params) => {
		const h = handlers[i++];
		if (!h) throw new Error(`Unexpected query #${i}: ${sql}`);
		const result = h(sql, params);
		if (!result) throw new Error(`Handler ${i - 1} returned undefined for: ${sql}`);
		return result;
	};
}

// ============================================================
// resolvePermissionsWith
// ============================================================

describe("resolvePermissionsWith", () => {
	test("super_admin role short-circuits to all permissions", async () => {
		const query = makeQuery([
			(sql) => {
				expect(sql).toContain('FROM "user"');
				return { rows: [{ id: "u1", role: "super_admin" }] };
			},
		]);
		const result = await resolvePermissionsWith(query, "u1");
		expect(result.isSuperAdmin).toBe(true);
		expect(result.role).toBe("super_admin");
		expect(result.permissions.user).toContain("delete");
		expect(result.permissions.user).toContain("impersonate");
		expect(result.permissions.user).toContain("list");
	});

	test("user with no role returns empty permissions (and ignores any overrides)", async () => {
		const query = makeQuery([
			() => ({ rows: [{ id: "u1", role: null }] }),
			() => ({ rows: [] }), // no overrides
		]);
		const result = await resolvePermissionsWith(query, "u1");
		expect(result.isSuperAdmin).toBe(false);
		expect(result.role).toBeNull();
		expect(result.permissions).toEqual({});
	});

	test("unknown user returns empty permissions", async () => {
		const query = makeQuery([() => ({ rows: [] })]);
		const result = await resolvePermissionsWith(query, "missing");
		expect(result.role).toBeNull();
		expect(result.permissions).toEqual({});
	});

	test("user with role gets role permissions when role exists", async () => {
		const query = makeQuery([
			() => ({ rows: [{ id: "u1", role: "viewer" }] }),
			() => ({ rows: [ROLE_VIEWER_ROW] }),
			() => ({ rows: [] }), // no overrides
		]);
		const result = await resolvePermissionsWith(query, "u1");
		expect(result.role).toBe("viewer");
		expect(result.permissions.user).toEqual(["read", "list"]);
		expect(result.isSuperAdmin).toBe(false);
	});

	test("override with granted=true adds a permission", async () => {
		const query = makeQuery([
			() => ({ rows: [{ id: "u1", role: "viewer" }] }),
			() => ({ rows: [ROLE_VIEWER_ROW] }),
			() => ({
				rows: [{ resource: "user", action: "update", granted: true }],
			}),
		]);
		const result = await resolvePermissionsWith(query, "u1");
		expect(result.permissions.user).toContain("read");
		expect(result.permissions.user).toContain("list");
		expect(result.permissions.user).toContain("update");
	});

	test("override with granted=false removes an inherited permission", async () => {
		const query = makeQuery([
			() => ({ rows: [{ id: "u1", role: "editor" }] }),
			() => ({ rows: [ROLE_EDITOR_ROW] }),
			() => ({
				rows: [{ resource: "user", action: "update", granted: false }],
			}),
		]);
		const result = await resolvePermissionsWith(query, "u1");
		expect(result.permissions.user).toContain("read");
		expect(result.permissions.user).toContain("list");
		expect(result.permissions.user).not.toContain("update");
	});

	test("granted=true is idempotent if permission already present", async () => {
		const query = makeQuery([
			() => ({ rows: [{ id: "u1", role: "editor" }] }),
			() => ({ rows: [ROLE_EDITOR_ROW] }),
			() => ({
				rows: [{ resource: "user", action: "read", granted: true }],
			}),
		]);
		const result = await resolvePermissionsWith(query, "u1");
		expect(result.permissions.user?.filter((a) => a === "read").length).toBe(1);
	});

	test("granted=false on a permission the role doesn't have is a no-op", async () => {
		const query = makeQuery([
			() => ({ rows: [{ id: "u1", role: "viewer" }] }),
			() => ({ rows: [ROLE_VIEWER_ROW] }),
			() => ({
				rows: [{ resource: "user", action: "delete", granted: false }],
			}),
		]);
		const result = await resolvePermissionsWith(query, "u1");
		expect(result.permissions.user).not.toContain("delete");
	});

	test("multiple overrides apply in order", async () => {
		const query = makeQuery([
			() => ({ rows: [{ id: "u1", role: "viewer" }] }),
			() => ({ rows: [ROLE_VIEWER_ROW] }),
			() => ({
				rows: [
					{ resource: "user", action: "create", granted: true },
					{ resource: "user", action: "delete", granted: true },
					{ resource: "user", action: "list", granted: false },
				],
			}),
		]);
		const result = await resolvePermissionsWith(query, "u1");
		expect(result.permissions.user).toContain("create");
		expect(result.permissions.user).toContain("delete");
		expect(result.permissions.user).toContain("read");
		expect(result.permissions.user).not.toContain("list");
	});

	test("role lookup returning no rows leaves permissions empty (then overrides may add)", async () => {
		const query = makeQuery([
			() => ({ rows: [{ id: "u1", role: "ghost" }] }),
			() => ({ rows: [] }), // role not in custom_role table
			() => ({
				rows: [{ resource: "user", action: "read", granted: true }],
			}),
		]);
		const result = await resolvePermissionsWith(query, "u1");
		expect(result.role).toBe("ghost");
		expect(result.permissions.user).toEqual(["read"]);
	});
});

// ============================================================
// hasPermission
// ============================================================

describe("hasPermission", () => {
	test("super_admin always returns true", () => {
		const resolved = {
			userId: "u1",
			role: "super_admin",
			isSuperAdmin: true,
			permissions: {},
		};
		expect(hasPermission(resolved, "user", "delete")).toBe(true);
		expect(hasPermission(resolved, "user", "list")).toBe(true);
	});

	test("returns true when action is in permission list", () => {
		const resolved = {
			userId: "u1",
			role: "viewer",
			isSuperAdmin: false,
			permissions: { user: ["read", "list"] as ("read" | "list")[] },
		};
		expect(hasPermission(resolved, "user", "read")).toBe(true);
		expect(hasPermission(resolved, "user", "list")).toBe(true);
	});

	test("returns false when action is not in permission list", () => {
		const resolved = {
			userId: "u1",
			role: "viewer",
			isSuperAdmin: false,
			permissions: { user: ["read", "list"] as ("read" | "list")[] },
		};
		expect(hasPermission(resolved, "user", "delete")).toBe(false);
		expect(hasPermission(resolved, "user", "create")).toBe(false);
	});

	test("returns false for resource not in permissions", () => {
		const resolved = {
			userId: "u1",
			role: "viewer",
			isSuperAdmin: false,
			permissions: {},
		};
		expect(hasPermission(resolved, "user", "read")).toBe(false);
	});
});
