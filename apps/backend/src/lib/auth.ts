import { betterAuth } from "better-auth";
import { openAPI, jwt } from "better-auth/plugins";
import { Redis } from "ioredis";
import { db } from "./db";

const redis = new Redis(process.env.REDIS_URL as string, {
	family: 4,
	lazyConnect: true,
	commandTimeout: 5000,
	enableReadyCheck: false,
	maxRetriesPerRequest: 3,
	retryStrategy: (times) => Math.min(times * 200, 5000),
}).on("error", (err) => {
	console.error("Redis connection error:", err.message);
});

export { db };

export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET || "fibex_default_secret_for_protection",
	baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
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
			role: {
				type: "string",
				required: false,
				defaultValue: "viewer",
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
	plugins: [openAPI(), jwt()],
	database: db,
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
