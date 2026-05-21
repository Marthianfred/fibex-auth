import { Hono } from "hono";
import { auth, db } from "./lib/auth";
import { resolvePermissions, hasPermission, type Action } from "./lib/permissions";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";

const app = new Hono();

app.use(logger());
app.use(
	cors({
		origin: (origin) => origin,
		allowHeaders: ["Content-Type", "Authorization", "x-admin-secret"],
		allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		credentials: true,
	})
);

app.get("/", (c) =>
	c.text("FIBEX Auth Server is running. Visit /ui for API Documentation.")
);

app.get("/health", (c) =>
	c.json({ status: "ok", timestamp: new Date().toISOString() })
);

app.get("/ui", swaggerUI({ url: "/api/auth/open-api/generate-schema" }));

app.get("/api/access/validate", async (c) => {
	const appId = c.req.query("appId");
	if (!appId) {
		return c.json({ authorized: false, message: "appId is required" }, 400);
	}
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ authorized: false, message: "No active session" }, 401);
	}
	const user = session.user as any;
	if (user.role === "super_admin" || user.role === "admin") {
		return c.json({
			authorized: true,
			user: { id: user.id, email: user.email, role: user.role },
		});
	}
	const isAuthorized = (((user.allowedApps as string) || "") + "")
		.split(",")
		.some((s) => s.trim() === appId);
	return c.json({
		authorized: isAuthorized,
		user: { id: user.id, email: user.email, role: user.role },
	});
});

// ------------------------------------------------------------------
// Admin bypass via shared secret (for system-to-system calls)
// ------------------------------------------------------------------
function isAdminBypass(c: any): boolean {
	const expected = process.env.ADMIN_SECRET;
	if (!expected) return false;
	const authHeader = c.req.header("Authorization");
	const adminSecretHeader = c.req.header("x-admin-secret");
	return (
		authHeader === `Bearer ${expected}` || adminSecretHeader === expected
	);
}

// ------------------------------------------------------------------
// Helper: require session + specific permission, OR admin bypass
// ------------------------------------------------------------------
async function requirePermission(c: any, action: Action) {
	if (isAdminBypass(c)) return { ok: true as const, bypass: true };
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return {
			ok: false as const,
			response: c.json({ error: "Not authenticated" }, 401),
		};
	}
	const resolved = await resolvePermissions(session.user.id);
	if (!hasPermission(resolved, "user", action)) {
		return {
			ok: false as const,
			response: c.json(
				{ error: `Missing permission: user.${action}` },
				403
			),
		};
	}
	return { ok: true as const, session, resolved };
}

// ------------------------------------------------------------------
// Custom Roles CRUD
// ------------------------------------------------------------------
app.get("/api/admin/custom-roles", async (c) => {
	const check = await requirePermission(c, "read");
	if (!check.ok) return check.response;
	const result = await db.query(
		'SELECT id, name, description, permissions, "createdAt", "updatedAt" FROM custom_role ORDER BY name'
	);
	return c.json({ roles: result.rows });
});

app.post("/api/admin/custom-roles", async (c) => {
	const check = await requirePermission(c, "set-role");
	if (!check.ok) return check.response;
	const body = await c.req.json();
	const { name, description, permissions } = body;
	if (!name || typeof name !== "string") {
		return c.json({ error: "name is required" }, 400);
	}
	try {
		const result = await db.query(
			"INSERT INTO custom_role (name, description, permissions) VALUES ($1, $2, $3) RETURNING *",
			[name, description || null, permissions || {}]
		);
		return c.json({ role: result.rows[0] }, 201);
	} catch (e: any) {
		return c.json({ error: e.message }, 400);
	}
});

app.patch("/api/admin/custom-roles/:id", async (c) => {
	const check = await requirePermission(c, "set-role");
	if (!check.ok) return check.response;
	const id = c.req.param("id");
	const body = await c.req.json();
	const { name, description, permissions } = body;
	const result = await db.query(
		`UPDATE custom_role SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        permissions = COALESCE($3, permissions),
        "updatedAt" = now()
      WHERE id = $4 RETURNING *`,
		[name ?? null, description ?? null, permissions ?? null, id]
	);
	if (result.rows.length === 0) {
		return c.json({ error: "Role not found" }, 404);
	}
	return c.json({ role: result.rows[0] });
});

app.delete("/api/admin/custom-roles/:id", async (c) => {
	const check = await requirePermission(c, "set-role");
	if (!check.ok) return check.response;
	const id = c.req.param("id");
	const result = await db.query(
		"DELETE FROM custom_role WHERE id = $1 RETURNING name",
		[id]
	);
	if (result.rows.length === 0) {
		return c.json({ error: "Role not found" }, 404);
	}
	return c.json({ deleted: result.rows[0].name });
});

// ------------------------------------------------------------------
// User Permission Overrides
// ------------------------------------------------------------------
app.get("/api/admin/users/:userId/overrides", async (c) => {
	const check = await requirePermission(c, "read");
	if (!check.ok) return check.response;
	const userId = c.req.param("userId");
	const result = await db.query(
		'SELECT id, resource, action, granted, "createdAt" FROM user_permission_override WHERE "userId" = $1 ORDER BY resource, action',
		[userId]
	);
	return c.json({ overrides: result.rows });
});

app.post("/api/admin/users/:userId/overrides", async (c) => {
	const check = await requirePermission(c, "set-role");
	if (!check.ok) return check.response;
	const userId = c.req.param("userId");
	const body = await c.req.json();
	const { resource, action, granted } = body;
	if (!resource || !action || typeof granted !== "boolean") {
		return c.json(
			{ error: "resource, action, granted are required" },
			400
		);
	}
	const result = await db.query(
		`INSERT INTO user_permission_override ("userId", resource, action, granted)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT ("userId", resource, action) DO UPDATE SET granted = EXCLUDED.granted
      RETURNING *`,
		[userId, resource, action, granted]
	);
	return c.json({ override: result.rows[0] }, 201);
});

app.delete("/api/admin/users/:userId/overrides/:overrideId", async (c) => {
	const check = await requirePermission(c, "set-role");
	if (!check.ok) return check.response;
	const userId = c.req.param("userId");
	const overrideId = c.req.param("overrideId");
	const result = await db.query(
		'DELETE FROM user_permission_override WHERE id = $1 AND "userId" = $2 RETURNING id',
		[overrideId, userId]
	);
	if (result.rows.length === 0) {
		return c.json({ error: "Override not found" }, 404);
	}
	return c.json({ deleted: overrideId });
});

// ------------------------------------------------------------------
// User Management (custom, replaces Better Auth admin plugin)
// ------------------------------------------------------------------
app.get("/api/admin/users", async (c) => {
	const check = await requirePermission(c, "list");
	if (!check.ok) return check.response;
	const limit = Math.min(Number(c.req.query("limit") || 100), 500);
	const offset = Number(c.req.query("offset") || 0);
	const search = c.req.query("search");

	let where = "";
	const params: any[] = [];
	if (search) {
		params.push(`%${search}%`);
		where = `WHERE email ILIKE $${params.length} OR name ILIKE $${params.length}`;
	}

	const usersResult = await db.query(
		`SELECT id, name, email, role, banned, "banReason", "createdAt", "updatedAt", "emailVerified", "allowedApps"
       FROM "user" ${where}
       ORDER BY "createdAt" DESC
       LIMIT ${limit} OFFSET ${offset}`,
		params
	);
	const totalResult = await db.query(
		`SELECT COUNT(*)::int as c FROM "user" ${where}`,
		params
	);
	return c.json({
		users: usersResult.rows,
		total: totalResult.rows[0].c,
		limit,
		offset,
	});
});

app.get("/api/admin/users/:id", async (c) => {
	const check = await requirePermission(c, "read");
	if (!check.ok) return check.response;
	const id = c.req.param("id");
	const result = await db.query(
		`SELECT id, name, email, role, banned, "banReason", "banExpires", "createdAt", "updatedAt", "emailVerified", "allowedApps"
       FROM "user" WHERE id = $1`,
		[id]
	);
	if (result.rows.length === 0) {
		return c.json({ error: "User not found" }, 404);
	}
	return c.json({ user: result.rows[0] });
});

app.post("/api/admin/users", async (c) => {
	const check = await requirePermission(c, "create");
	if (!check.ok) return check.response;
	const body = await c.req.json();
	const { email, password, name, role } = body;
	if (!email || !password || !name) {
		return c.json({ error: "email, password, name required" }, 400);
	}
	try {
		const result = await auth.api.signUpEmail({
			body: { email, password, name },
		});
		if (role && "user" in result) {
			await db.query('UPDATE "user" SET role = $1 WHERE email = $2', [
				role,
				email,
			]);
			(result.user as any).role = role;
		}
		return c.json(result, 201);
	} catch (e: any) {
		return c.json({ error: e.message }, 400);
	}
});

app.patch("/api/admin/users/:id", async (c) => {
	const check = await requirePermission(c, "update");
	if (!check.ok) return check.response;
	const id = c.req.param("id");
	const body = await c.req.json();
	const { name, email, role, allowedApps } = body;
	const fields: string[] = [];
	const values: any[] = [];
	let i = 1;
	if (name !== undefined) {
		fields.push(`name = $${i++}`);
		values.push(name);
	}
	if (email !== undefined) {
		fields.push(`email = $${i++}`);
		values.push(email);
	}
	if (role !== undefined) {
		const roleCheck = await requirePermission(c, "set-role");
		if (!roleCheck.ok) return roleCheck.response;
		fields.push(`role = $${i++}`);
		values.push(role);
	}
	if (allowedApps !== undefined) {
		fields.push(`"allowedApps" = $${i++}`);
		values.push(allowedApps);
	}
	if (fields.length === 0) {
		return c.json({ error: "No fields to update" }, 400);
	}
	fields.push(`"updatedAt" = now()`);
	values.push(id);
	const result = await db.query(
		`UPDATE "user" SET ${fields.join(", ")} WHERE id = $${i} RETURNING id, name, email, role, "allowedApps"`,
		values
	);
	if (result.rows.length === 0) {
		return c.json({ error: "User not found" }, 404);
	}
	return c.json({ user: result.rows[0] });
});

app.delete("/api/admin/users/:id", async (c) => {
	const check = await requirePermission(c, "delete");
	if (!check.ok) return check.response;
	const id = c.req.param("id");
	const result = await db.query(
		'DELETE FROM "user" WHERE id = $1 RETURNING id',
		[id]
	);
	if (result.rows.length === 0) {
		return c.json({ error: "User not found" }, 404);
	}
	return c.json({ deleted: id });
});

app.post("/api/admin/users/:id/ban", async (c) => {
	const check = await requirePermission(c, "ban");
	if (!check.ok) return check.response;
	const id = c.req.param("id");
	const body = await c.req.json().catch(() => ({}));
	const reason = body.banReason || "Banned by admin";
	const result = await db.query(
		'UPDATE "user" SET banned = true, "banReason" = $1, "updatedAt" = now() WHERE id = $2 RETURNING id, banned, "banReason"',
		[reason, id]
	);
	if (result.rows.length === 0) {
		return c.json({ error: "User not found" }, 404);
	}
	return c.json({ user: result.rows[0] });
});

app.post("/api/admin/users/:id/unban", async (c) => {
	const check = await requirePermission(c, "unban");
	if (!check.ok) return check.response;
	const id = c.req.param("id");
	const result = await db.query(
		'UPDATE "user" SET banned = false, "banReason" = null, "banExpires" = null, "updatedAt" = now() WHERE id = $1 RETURNING id, banned',
		[id]
	);
	if (result.rows.length === 0) {
		return c.json({ error: "User not found" }, 404);
	}
	return c.json({ user: result.rows[0] });
});

app.get("/api/admin/me/permissions", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) return c.json({ error: "Not authenticated" }, 401);
	const resolved = await resolvePermissions(session.user.id);
	return c.json(resolved);
});

// ------------------------------------------------------------------
// Better Auth catch-all
// ------------------------------------------------------------------
app.all("/api/auth/**", async (c) => auth.handler(c.req.raw));

export default {
	port: process.env.PORT ? Number(process.env.PORT) : 3000,
	hostname: "::",
	fetch: app.fetch,
};
