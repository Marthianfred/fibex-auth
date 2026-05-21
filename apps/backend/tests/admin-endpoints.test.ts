import { describe, test, expect, beforeEach } from "bun:test";
import { createApp, type AppDeps } from "../src/app";

// Minimal mock DB. Each test installs `queries` to control SQL responses.
function makeMockDb() {
	const calls: Array<{ sql: string; params?: any[] }> = [];
	let handlers: Array<(sql: string, params?: any[]) => { rows: any[] }> = [];

	const db: AppDeps["db"] = {
		query: async (sql: string, params?: any[]) => {
			calls.push({ sql, params });
			const handler = handlers.shift();
			if (!handler) {
				throw new Error(`Unexpected query: ${sql}`);
			}
			return handler(sql, params);
		},
	};

	return {
		db,
		setHandlers(
			fns: Array<(sql: string, params?: any[]) => { rows: any[] }>
		) {
			handlers = [...fns];
		},
		calls,
	};
}

// Default deps: no session, no admin bypass.
function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
	const { db } = makeMockDb();
	return {
		db,
		getSession: async () => null,
		adminSecret: undefined,
		...overrides,
	};
}

// ============================================================
// AUTHENTICATION GUARDS
// ============================================================
describe("/api/admin/users — auth guards", () => {
	test("returns 401 when no session and no admin bypass", async () => {
		const app = createApp(makeDeps());
		const res = await app.request("/api/admin/users", { method: "GET" });
		expect(res.status).toBe(401);
	});

	test("returns 403 when user has no list permission", async () => {
		const mockDb = makeMockDb();
		// resolvePermissions: user lookup returns viewer-like user without list
		mockDb.setHandlers([
			() => ({ rows: [{ id: "u1", role: "ghost" }] }),
			() => ({ rows: [] }), // role not in custom_role
			() => ({ rows: [] }), // no overrides
		]);
		const app = createApp({
			db: mockDb.db,
			getSession: async () => ({ user: { id: "u1" } }),
		});
		const res = await app.request("/api/admin/users");
		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.error).toMatch(/user\.list/);
	});

	test("returns 200 when user is super_admin", async () => {
		const mockDb = makeMockDb();
		mockDb.setHandlers([
			() => ({ rows: [{ id: "u1", role: "super_admin" }] }),
			// list users
			() => ({
				rows: [
					{
						id: "u1",
						name: "Admin",
						email: "a@b.c",
						role: "super_admin",
						banned: false,
						banReason: null,
						createdAt: "now",
						updatedAt: "now",
						emailVerified: true,
						allowedApps: "",
					},
				],
			}),
			// total
			() => ({ rows: [{ c: 1 }] }),
		]);
		const app = createApp({
			db: mockDb.db,
			getSession: async () => ({ user: { id: "u1" } }),
		});
		const res = await app.request("/api/admin/users");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.users).toHaveLength(1);
		expect(body.total).toBe(1);
	});

	test("admin bypass via x-admin-secret returns 200 without session", async () => {
		const mockDb = makeMockDb();
		mockDb.setHandlers([
			() => ({ rows: [] }),
			() => ({ rows: [{ c: 0 }] }),
		]);
		const app = createApp({
			db: mockDb.db,
			getSession: async () => null,
			adminSecret: "topsecret",
		});
		const res = await app.request("/api/admin/users", {
			headers: { "x-admin-secret": "topsecret" },
		});
		expect(res.status).toBe(200);
	});

	test("wrong x-admin-secret returns 401", async () => {
		const app = createApp({
			db: makeMockDb().db,
			getSession: async () => null,
			adminSecret: "topsecret",
		});
		const res = await app.request("/api/admin/users", {
			headers: { "x-admin-secret": "wrong" },
		});
		expect(res.status).toBe(401);
	});

	test("Authorization: Bearer admin secret works", async () => {
		const mockDb = makeMockDb();
		mockDb.setHandlers([
			() => ({ rows: [] }),
			() => ({ rows: [{ c: 0 }] }),
		]);
		const app = createApp({
			db: mockDb.db,
			getSession: async () => null,
			adminSecret: "topsecret",
		});
		const res = await app.request("/api/admin/users", {
			headers: { Authorization: "Bearer topsecret" },
		});
		expect(res.status).toBe(200);
	});
});

// ============================================================
// CUSTOM ROLES CRUD
// ============================================================
describe("/api/admin/custom-roles", () => {
	test("GET lists roles when user has user.read", async () => {
		const mockDb = makeMockDb();
		mockDb.setHandlers([
			// resolvePermissions
			() => ({ rows: [{ id: "u1", role: "viewer" }] }),
			() => ({ rows: [{ permissions: { user: ["read", "list"] } }] }),
			() => ({ rows: [] }),
			// list roles
			() => ({
				rows: [
					{
						id: "r1",
						name: "viewer",
						description: null,
						permissions: { user: ["read"] },
						createdAt: "now",
						updatedAt: "now",
					},
				],
			}),
		]);
		const app = createApp({
			db: mockDb.db,
			getSession: async () => ({ user: { id: "u1" } }),
		});
		const res = await app.request("/api/admin/custom-roles");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.roles).toHaveLength(1);
	});

	test("POST requires user.set-role permission", async () => {
		const mockDb = makeMockDb();
		mockDb.setHandlers([
			// viewer lacks set-role
			() => ({ rows: [{ id: "u1", role: "viewer" }] }),
			() => ({ rows: [{ permissions: { user: ["read", "list"] } }] }),
			() => ({ rows: [] }),
		]);
		const app = createApp({
			db: mockDb.db,
			getSession: async () => ({ user: { id: "u1" } }),
		});
		const res = await app.request("/api/admin/custom-roles", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "newrole" }),
		});
		expect(res.status).toBe(403);
	});

	test("POST creates role when super_admin", async () => {
		const mockDb = makeMockDb();
		mockDb.setHandlers([
			() => ({ rows: [{ id: "u1", role: "super_admin" }] }),
			() => ({
				rows: [
					{
						id: "newid",
						name: "newrole",
						description: null,
						permissions: {},
					},
				],
			}),
		]);
		const app = createApp({
			db: mockDb.db,
			getSession: async () => ({ user: { id: "u1" } }),
		});
		const res = await app.request("/api/admin/custom-roles", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "newrole" }),
		});
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.role.name).toBe("newrole");
	});

	test("POST returns 400 when name missing", async () => {
		const mockDb = makeMockDb();
		mockDb.setHandlers([
			() => ({ rows: [{ id: "u1", role: "super_admin" }] }),
		]);
		const app = createApp({
			db: mockDb.db,
			getSession: async () => ({ user: { id: "u1" } }),
		});
		const res = await app.request("/api/admin/custom-roles", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(400);
	});
});

// ============================================================
// USER PERMISSION OVERRIDES
// ============================================================
describe("/api/admin/users/:id/overrides", () => {
	test("POST upserts an override when super_admin", async () => {
		const mockDb = makeMockDb();
		mockDb.setHandlers([
			() => ({ rows: [{ id: "u1", role: "super_admin" }] }),
			() => ({
				rows: [
					{
						id: "ov1",
						userId: "target",
						resource: "user",
						action: "delete",
						granted: true,
					},
				],
			}),
		]);
		const app = createApp({
			db: mockDb.db,
			getSession: async () => ({ user: { id: "u1" } }),
		});
		const res = await app.request("/api/admin/users/target/overrides", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				resource: "user",
				action: "delete",
				granted: true,
			}),
		});
		expect(res.status).toBe(201);
	});

	test("POST returns 400 when body is incomplete", async () => {
		const mockDb = makeMockDb();
		mockDb.setHandlers([
			() => ({ rows: [{ id: "u1", role: "super_admin" }] }),
		]);
		const app = createApp({
			db: mockDb.db,
			getSession: async () => ({ user: { id: "u1" } }),
		});
		const res = await app.request("/api/admin/users/target/overrides", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ resource: "user" }),
		});
		expect(res.status).toBe(400);
	});
});

// ============================================================
// USER OPERATIONS
// ============================================================
describe("/api/admin/users/:id ban/unban/delete", () => {
	test("POST /ban requires user.ban", async () => {
		const mockDb = makeMockDb();
		mockDb.setHandlers([
			// viewer lacks ban
			() => ({ rows: [{ id: "u1", role: "viewer" }] }),
			() => ({ rows: [{ permissions: { user: ["read", "list"] } }] }),
			() => ({ rows: [] }),
		]);
		const app = createApp({
			db: mockDb.db,
			getSession: async () => ({ user: { id: "u1" } }),
		});
		const res = await app.request("/api/admin/users/x/ban", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(403);
	});

	test("DELETE returns 404 when user doesn't exist", async () => {
		const mockDb = makeMockDb();
		mockDb.setHandlers([
			() => ({ rows: [{ id: "u1", role: "super_admin" }] }),
			() => ({ rows: [] }),
		]);
		const app = createApp({
			db: mockDb.db,
			getSession: async () => ({ user: { id: "u1" } }),
		});
		const res = await app.request("/api/admin/users/missing", {
			method: "DELETE",
		});
		expect(res.status).toBe(404);
	});
});

// ============================================================
// /api/admin/me/permissions
// ============================================================
describe("/api/admin/me/permissions", () => {
	test("returns 401 when no session", async () => {
		const app = createApp(makeDeps());
		const res = await app.request("/api/admin/me/permissions");
		expect(res.status).toBe(401);
	});

	test("returns resolved permissions of current user", async () => {
		const mockDb = makeMockDb();
		mockDb.setHandlers([
			() => ({ rows: [{ id: "u1", role: "super_admin" }] }),
		]);
		const app = createApp({
			db: mockDb.db,
			getSession: async () => ({ user: { id: "u1" } }),
		});
		const res = await app.request("/api/admin/me/permissions");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.isSuperAdmin).toBe(true);
		expect(body.role).toBe("super_admin");
	});
});

// ============================================================
// HEALTH / ROOT
// ============================================================
describe("public routes", () => {
	test("GET /health returns 200 ok", async () => {
		const app = createApp(makeDeps());
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.status).toBe("ok");
	});

	test("GET / returns running message", async () => {
		const app = createApp(makeDeps());
		const res = await app.request("/");
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toMatch(/FIBEX/i);
	});
});
