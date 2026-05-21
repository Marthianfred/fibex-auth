import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
	adminApi,
	rolesApi,
	overridesApi,
	meApi,
} from "../admin-api";

// ---------- fetch mock ----------
interface MockCall {
	url: string;
	init?: RequestInit;
}

let calls: MockCall[] = [];
let nextResponse: { status: number; body: any } = { status: 200, body: {} };

const originalFetch = globalThis.fetch;

beforeEach(() => {
	calls = [];
	nextResponse = { status: 200, body: {} };
	globalThis.fetch = (async (url: any, init?: RequestInit) => {
		calls.push({ url: String(url), init });
		return new Response(JSON.stringify(nextResponse.body), {
			status: nextResponse.status,
			headers: { "Content-Type": "application/json" },
		});
	}) as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function setResponse(status: number, body: any) {
	nextResponse = { status, body };
}

// ============================================================
// adminApi.listUsers
// ============================================================
describe("adminApi.listUsers", () => {
	test("calls /api/admin/users with query params", async () => {
		setResponse(200, { users: [], total: 0, limit: 50, offset: 0 });
		const res = await adminApi.listUsers({
			query: { limit: 50, offset: 0, search: "freddy" },
		});
		expect(res.error).toBeNull();
		expect(res.data?.total).toBe(0);
		expect(calls[0].url).toContain("/api/admin/users?");
		expect(calls[0].url).toContain("limit=50");
		expect(calls[0].url).toContain("offset=0");
		expect(calls[0].url).toContain("search=freddy");
	});

	test("returns error string on non-2xx", async () => {
		setResponse(403, { error: "Missing permission: user.list" });
		const res = await adminApi.listUsers({ query: { limit: 10, offset: 0 } });
		expect(res.data).toBeNull();
		expect(res.error).toBe("Missing permission: user.list");
	});

	test("includes credentials in request", async () => {
		setResponse(200, { users: [], total: 0 });
		await adminApi.listUsers({ query: { limit: 10, offset: 0 } });
		expect((calls[0].init as any).credentials).toBe("include");
	});
});

// ============================================================
// adminApi.getUser / createUser / updateUser
// ============================================================
describe("adminApi user CRUD", () => {
	test("getUser hits /api/admin/users/:id", async () => {
		setResponse(200, { user: { id: "u1", email: "a@b.c" } });
		const res = await adminApi.getUser({ query: { userId: "u1" } });
		expect(res.data?.user.id).toBe("u1");
		expect(calls[0].url).toContain("/api/admin/users/u1");
	});

	test("createUser POSTs to /api/admin/users", async () => {
		setResponse(201, { user: { id: "newid" } });
		await adminApi.createUser({
			body: {
				name: "X",
				email: "x@y.z",
				password: "secret",
				role: "viewer",
			},
		});
		expect(calls[0].init?.method).toBe("POST");
		expect(calls[0].url).toBe("/api/admin/users");
		const body = JSON.parse(String(calls[0].init?.body));
		expect(body.email).toBe("x@y.z");
		expect(body.role).toBe("viewer");
	});

	test("updateUser PATCHes /api/admin/users/:id with body sans userId", async () => {
		setResponse(200, { user: { id: "u1", name: "Y" } });
		await adminApi.updateUser({
			body: { userId: "u1", name: "Y" },
		});
		expect(calls[0].init?.method).toBe("PATCH");
		expect(calls[0].url).toBe("/api/admin/users/u1");
		const body = JSON.parse(String(calls[0].init?.body));
		expect(body).toEqual({ name: "Y" });
	});

	test("setRole PATCHes role only", async () => {
		setResponse(200, {});
		await adminApi.setRole({
			body: { userId: "u1", role: "editor" },
		});
		expect(calls[0].init?.method).toBe("PATCH");
		expect(calls[0].url).toBe("/api/admin/users/u1");
		const body = JSON.parse(String(calls[0].init?.body));
		expect(body).toEqual({ role: "editor" });
	});

	test("banUser POSTs to :id/ban with reason", async () => {
		setResponse(200, {});
		await adminApi.banUser({
			body: { userId: "u1", banReason: "spam" },
		});
		expect(calls[0].url).toBe("/api/admin/users/u1/ban");
		const body = JSON.parse(String(calls[0].init?.body));
		expect(body.banReason).toBe("spam");
	});

	test("unbanUser POSTs to :id/unban", async () => {
		setResponse(200, {});
		await adminApi.unbanUser({ body: { userId: "u1" } });
		expect(calls[0].init?.method).toBe("POST");
		expect(calls[0].url).toBe("/api/admin/users/u1/unban");
	});

	test("removeUser DELETEs /api/admin/users/:id", async () => {
		setResponse(200, {});
		await adminApi.removeUser({ body: { userId: "u1" } });
		expect(calls[0].init?.method).toBe("DELETE");
		expect(calls[0].url).toBe("/api/admin/users/u1");
	});
});

// ============================================================
// rolesApi
// ============================================================
describe("rolesApi", () => {
	test("list GETs /api/admin/custom-roles", async () => {
		setResponse(200, { roles: [] });
		await rolesApi.list();
		expect(calls[0].url).toBe("/api/admin/custom-roles");
	});

	test("create POSTs with body", async () => {
		setResponse(201, { role: { id: "r1", name: "viewer" } });
		await rolesApi.create({
			name: "viewer",
			permissions: { user: ["read"] },
		});
		expect(calls[0].init?.method).toBe("POST");
		const body = JSON.parse(String(calls[0].init?.body));
		expect(body.name).toBe("viewer");
		expect(body.permissions.user).toEqual(["read"]);
	});

	test("update PATCHes /api/admin/custom-roles/:id", async () => {
		setResponse(200, {});
		await rolesApi.update("r1", { description: "updated" });
		expect(calls[0].init?.method).toBe("PATCH");
		expect(calls[0].url).toBe("/api/admin/custom-roles/r1");
	});

	test("remove DELETEs", async () => {
		setResponse(200, {});
		await rolesApi.remove("r1");
		expect(calls[0].init?.method).toBe("DELETE");
		expect(calls[0].url).toBe("/api/admin/custom-roles/r1");
	});
});

// ============================================================
// overridesApi
// ============================================================
describe("overridesApi", () => {
	test("list GETs user overrides", async () => {
		setResponse(200, { overrides: [] });
		await overridesApi.list("u1");
		expect(calls[0].url).toBe("/api/admin/users/u1/overrides");
	});

	test("upsert POSTs with resource/action/granted", async () => {
		setResponse(201, {});
		await overridesApi.upsert("u1", {
			resource: "user",
			action: "delete",
			granted: true,
		});
		expect(calls[0].init?.method).toBe("POST");
		const body = JSON.parse(String(calls[0].init?.body));
		expect(body).toEqual({
			resource: "user",
			action: "delete",
			granted: true,
		});
	});

	test("remove DELETEs specific override", async () => {
		setResponse(200, {});
		await overridesApi.remove("u1", "ov1");
		expect(calls[0].init?.method).toBe("DELETE");
		expect(calls[0].url).toBe("/api/admin/users/u1/overrides/ov1");
	});
});

// ============================================================
// meApi
// ============================================================
describe("meApi", () => {
	test("getPermissions GETs /api/admin/me/permissions", async () => {
		setResponse(200, {
			userId: "u1",
			role: "super_admin",
			isSuperAdmin: true,
			permissions: { user: [] },
		});
		const res = await meApi.getPermissions();
		expect(res.data?.isSuperAdmin).toBe(true);
		expect(calls[0].url).toBe("/api/admin/me/permissions");
	});
});

// ============================================================
// network errors
// ============================================================
describe("network errors", () => {
	test("fetch throwing returns { data: null, error }", async () => {
		globalThis.fetch = (async () => {
			throw new Error("Network down");
		}) as typeof fetch;
		const res = await adminApi.listUsers({ query: { limit: 1, offset: 0 } });
		expect(res.data).toBeNull();
		expect(res.error).toBe("Network down");
	});
});
