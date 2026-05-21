import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import {
	resolvePermissionsWith,
	hasPermission,
	type Action,
	type QueryFn,
} from "./lib/permissions";

export interface AppDeps {
	db: { query: QueryFn };
	getSession: (req: Request) => Promise<{ user: { id: string } } | null>;
	adminSecret?: string;
	// Optional better-auth handler — when missing, /api/auth/** is not exposed (tests).
	authHandler?: (req: Request) => Promise<Response> | Response;
	// Optional sign-up function used by POST /api/admin/users.
	signUpEmail?: (body: {
		email: string;
		password: string;
		name: string;
	}) => Promise<unknown>;
	// Optional Swagger UI middleware.
	swagger?: (c: any) => Promise<Response> | Response;
	enableLogger?: boolean;
}

export function createApp(deps: AppDeps): Hono {
	const app = new Hono();

	if (deps.enableLogger) {
		app.use(logger());
	}

	app.use(
		cors({
			origin: (origin) => origin,
			allowHeaders: ["Content-Type", "Authorization", "x-admin-secret"],
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			credentials: true,
		})
	);

	// ---------- public ----------
	app.get("/", (c) =>
		c.text(
			"FIBEX Auth Server is running. Visit /ui for API Documentation."
		)
	);
	app.get("/health", (c) =>
		c.json({ status: "ok", timestamp: new Date().toISOString() })
	);

	if (deps.swagger) {
		app.get("/ui", deps.swagger);
	}

	// ---------- /api/access/validate ----------
	app.get("/api/access/validate", async (c) => {
		const appId = c.req.query("appId");
		if (!appId) {
			return c.json(
				{ authorized: false, message: "appId is required" },
				400
			);
		}
		const session = await deps.getSession(c.req.raw);
		if (!session) {
			return c.json(
				{ authorized: false, message: "No active session" },
				401
			);
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

	// ---------- helpers ----------
	function isAdminBypass(c: any): boolean {
		if (!deps.adminSecret) return false;
		const authHeader = c.req.header("Authorization");
		const adminSecretHeader = c.req.header("x-admin-secret");
		return (
			authHeader === `Bearer ${deps.adminSecret}` ||
			adminSecretHeader === deps.adminSecret
		);
	}

	async function requirePermission(c: any, action: Action) {
		if (isAdminBypass(c)) return { ok: true as const, bypass: true };
		const session = await deps.getSession(c.req.raw);
		if (!session) {
			return {
				ok: false as const,
				response: c.json({ error: "Not authenticated" }, 401),
			};
		}
		const resolved = await resolvePermissionsWith(
			deps.db.query,
			session.user.id
		);
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

	// ---------- custom roles CRUD ----------
	app.get("/api/admin/custom-roles", async (c) => {
		const check = await requirePermission(c, "read");
		if (!check.ok) return check.response;
		const result = await deps.db.query(
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
			const result = await deps.db.query(
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
		const result = await deps.db.query(
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
		const result = await deps.db.query(
			"DELETE FROM custom_role WHERE id = $1 RETURNING name",
			[id]
		);
		if (result.rows.length === 0) {
			return c.json({ error: "Role not found" }, 404);
		}
		return c.json({ deleted: result.rows[0].name });
	});

	// ---------- per-user overrides ----------
	app.get("/api/admin/users/:userId/overrides", async (c) => {
		const check = await requirePermission(c, "read");
		if (!check.ok) return check.response;
		const userId = c.req.param("userId");
		const result = await deps.db.query(
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
		const result = await deps.db.query(
			`INSERT INTO user_permission_override ("userId", resource, action, granted)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT ("userId", resource, action) DO UPDATE SET granted = EXCLUDED.granted
      RETURNING *`,
			[userId, resource, action, granted]
		);
		return c.json({ override: result.rows[0] }, 201);
	});

	app.delete(
		"/api/admin/users/:userId/overrides/:overrideId",
		async (c) => {
			const check = await requirePermission(c, "set-role");
			if (!check.ok) return check.response;
			const userId = c.req.param("userId");
			const overrideId = c.req.param("overrideId");
			const result = await deps.db.query(
				'DELETE FROM user_permission_override WHERE id = $1 AND "userId" = $2 RETURNING id',
				[overrideId, userId]
			);
			if (result.rows.length === 0) {
				return c.json({ error: "Override not found" }, 404);
			}
			return c.json({ deleted: overrideId });
		}
	);

	// ---------- users CRUD ----------
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

		const usersResult = await deps.db.query(
			`SELECT id, name, email, role, banned, "banReason", "createdAt", "updatedAt", "emailVerified", "allowedApps"
       FROM "user" ${where}
       ORDER BY "createdAt" DESC
       LIMIT ${limit} OFFSET ${offset}`,
			params
		);
		const totalResult = await deps.db.query(
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
		const result = await deps.db.query(
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
		if (!deps.signUpEmail) {
			return c.json(
				{ error: "Sign-up not configured on this app instance" },
				501
			);
		}
		try {
			const result: any = await deps.signUpEmail({
				email,
				password,
				name,
			});
			if (role && result && "user" in result) {
				await deps.db.query(
					'UPDATE "user" SET role = $1 WHERE email = $2',
					[role, email]
				);
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
		const result = await deps.db.query(
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
		const result = await deps.db.query(
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
		const result = await deps.db.query(
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
		const result = await deps.db.query(
			'UPDATE "user" SET banned = false, "banReason" = null, "banExpires" = null, "updatedAt" = now() WHERE id = $1 RETURNING id, banned',
			[id]
		);
		if (result.rows.length === 0) {
			return c.json({ error: "User not found" }, 404);
		}
		return c.json({ user: result.rows[0] });
	});

	// ---------- /api/admin/me/permissions ----------
	app.get("/api/admin/me/permissions", async (c) => {
		const session = await deps.getSession(c.req.raw);
		if (!session) return c.json({ error: "Not authenticated" }, 401);
		const resolved = await resolvePermissionsWith(
			deps.db.query,
			session.user.id
		);
		return c.json(resolved);
	});

	// ---------- better-auth catch-all (optional) ----------
	if (deps.authHandler) {
		app.all("/api/auth/**", async (c) => deps.authHandler!(c.req.raw));
	}

	return app;
}
