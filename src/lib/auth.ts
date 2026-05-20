import { betterAuth } from "better-auth";
import { openAPI, admin } from "better-auth/plugins";
import { dashboardPlugin } from "better-auth-dashboard";
import { createAccessControl } from "better-auth/plugins/access";
import { Pool } from "pg";
import { Redis } from "ioredis"

const redis = new Redis(process.env.REDIS_URL as string, {
	family: 0,
	lazyConnect: true, // Performance: don't block startup
	commandTimeout: 1000, // Safety: don't hang if redis is slow
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

/**
 * Access Control Definition
 * Define permissions and roles for the system
 */
const ac = createAccessControl({
	user: ["create", "read", "update", "delete", "impersonate"],
	role: ["create", "read", "update", "delete"],
	app: ["manage"], // Custom permission for app management
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
	max: 20, // Performance: optimal pool size for concurrent requests
	idleTimeoutMillis: 30000, // Resource management: close idle connections
	connectionTimeoutMillis: 2000, // Safety: fail fast if DB is down
});

export const db = pool;

// Check better-auth docs for more info https://www.better-auth.com/docs/
export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET || "fibex_default_secret_for_protection",
	baseURL: process.env.BETTER_AUTH_URL,
	basePath: "/api/auth",
	trustedOrigins: ["*"],
	emailAndPassword: {
		enabled: true,
	},
	// User schema extension
	user: {
		additionalFields: {
			allowedApps: {
				type: "string",
				required: false,
				defaultValue: "", // Comma separated app IDs or JSON
				input: false, // Hidden from signup
			},
		},
	},
	// Session config
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60,
		},
	},
	// Add your plugins here
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
	// This is for the redis session storage
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
