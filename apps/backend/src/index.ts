import { swaggerUI } from "@hono/swagger-ui";
import { createApp } from "./app";
import { auth } from "./lib/auth";
import { db } from "./lib/db";

const app = createApp({
	db: { query: (sql, params) => db.query(sql, params) },
	getSession: async (req) => {
		const session = await auth.api.getSession({ headers: req.headers });
		return session ? { user: session.user as { id: string } } : null;
	},
	adminSecret: process.env.ADMIN_SECRET,
	authHandler: (req) => auth.handler(req),
	signUpEmail: async (body) =>
		auth.api.signUpEmail({
			body,
		}),
	swagger: swaggerUI({ url: "/api/auth/open-api/generate-schema" }) as any,
	enableLogger: true,
});

export default {
	port: process.env.PORT ? Number(process.env.PORT) : 3000,
	hostname: "::",
	fetch: app.fetch,
};
