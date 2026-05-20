import { betterAuth } from "better-auth";
import { openAPI, admin } from "better-auth/plugins";
import { dashboardPlugin } from "better-auth-dashboard";
import { createAccessControl } from "better-auth/plugins/access";
import { Pool } from "pg";
import { Redis } from "ioredis"

const redis = new Redis(process.env.REDIS_URL as string, {
	family: 0,
	lazyConnect: true,
	commandTimeout: 1000,
})
	.on("error", (err) => {
		console.error("Redis connection error:", err);
	})
	.on("connect", () => {
		console.log("Redis connected");
	})
	.on("ready", () => {
		console.log("Redis ready");
	});

const ac = createAccessControl({
	user: ["create", "read", "update", "delete", "impersonate"],
	role: ["create", "read", "update", "delete"],
	app: ["manage"],
});

const adminRole = ac.newRole({
	user: ["create", "read", "update", "delete", "impersonate"],
	role: ["create", "read", "update", "delete"],
	app: ["manage"],
});

const userRole = ac.newRole({
	user: ["read"],
	role: ["read"],
	app: [],
});

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 20,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 2000,
});

export const db = pool;

export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET || "fibex_default_secret_for_protection",
	baseURL: process.env.BETTER_AUTH_URL,
	basePath: "/api/auth",
	trustedOrigins: ["*"],
	emailAndPassword: {
		enabled: true,
	},
	user: {
		additionalFields: {
			allowedApps: {
				type: "string",
				required: false,
				defaultValue: "",
				input: false,
			},
		},
	},
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60,
		},
	},
	plugins: [
		openAPI(),
		admin({
			ac,
			roles: {
				admin: adminRole,
				user: userRole,
			},
			adminSecret: "fibexadmin123",
		}),
		dashboardPlugin(),
	],
	database: pool,
	secondaryStorage: {
		get: async (key) => {
			const value = await redis.get(key);
			return value;
		},
		set: async (key, value, ttl) => {
			if (ttl) {
				await redis.set(key, value, "EX", ttl);
			} else {
				await redis.set(key, value);
			}
		},
		delete: async (key) => {
			await redis.del(key);
		},
	},
});
