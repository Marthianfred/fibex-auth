import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UsersPage } from "../UsersPage";

const USERS_FIXTURE = [
	{
		id: "u1",
		name: "Freddy",
		email: "fcampos@grupoconex.net",
		role: "super_admin",
		banned: false,
		banReason: null,
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
		emailVerified: true,
		allowedApps: "",
	},
	{
		id: "u2",
		name: "QA",
		email: "qa@viaticos.com",
		role: "admin",
		banned: false,
		banReason: null,
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
		emailVerified: false,
		allowedApps: "",
	},
];

const ROLES_FIXTURE = [
	{
		id: "r1",
		name: "super_admin",
		description: "Full",
		permissions: {},
		createdAt: "",
		updatedAt: "",
	},
	{
		id: "r2",
		name: "admin",
		description: "Admin",
		permissions: {},
		createdAt: "",
		updatedAt: "",
	},
	{
		id: "r3",
		name: "editor",
		description: "Editor",
		permissions: {},
		createdAt: "",
		updatedAt: "",
	},
	{
		id: "r4",
		name: "viewer",
		description: "Viewer",
		permissions: {},
		createdAt: "",
		updatedAt: "",
	},
];

let calls: { url: string; init?: RequestInit }[] = [];

const originalFetch = globalThis.fetch;

beforeEach(() => {
	calls = [];
	globalThis.fetch = (async (url: any, init?: RequestInit) => {
		calls.push({ url: String(url), init });
		const urlStr = String(url);
		let body: any = {};
		if (urlStr.startsWith("/api/admin/users")) {
			body = { users: USERS_FIXTURE, total: USERS_FIXTURE.length };
		} else if (urlStr === "/api/admin/custom-roles") {
			body = { roles: ROLES_FIXTURE };
		}
		return new Response(JSON.stringify(body), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}) as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	document.body.innerHTML = "";
});

describe("UsersPage role rendering", () => {
	test("fetches both users and roles on mount", async () => {
		render(<UsersPage />);
		await waitFor(() => {
			expect(calls.some((c) => c.url.startsWith("/api/admin/users"))).toBe(true);
			expect(calls.some((c) => c.url === "/api/admin/custom-roles")).toBe(true);
		});
	});

	test("role select shows all custom roles as options", async () => {
		render(<UsersPage />);
		await waitFor(() =>
			expect(screen.getByText("fcampos@grupoconex.net")).toBeDefined()
		);
		// Each user has a select; pick the first
		const selects = screen.getAllByRole(
			"combobox"
		) as HTMLSelectElement[];
		const firstSelect = selects[0];
		const optionValues = Array.from(firstSelect.options).map(
			(o) => o.value
		);
		expect(optionValues).toContain("super_admin");
		expect(optionValues).toContain("admin");
		expect(optionValues).toContain("editor");
		expect(optionValues).toContain("viewer");
	});

	test("user with role super_admin has the select set to super_admin", async () => {
		render(<UsersPage />);
		await waitFor(() =>
			expect(screen.getByText("fcampos@grupoconex.net")).toBeDefined()
		);
		const selects = screen.getAllByRole(
			"combobox"
		) as HTMLSelectElement[];
		// First user is fcampos with super_admin
		expect(selects[0].value).toBe("super_admin");
	});

	test("user with role admin shows admin in select", async () => {
		render(<UsersPage />);
		await waitFor(() =>
			expect(screen.getByText("qa@viaticos.com")).toBeDefined()
		);
		const selects = screen.getAllByRole(
			"combobox"
		) as HTMLSelectElement[];
		expect(selects[1].value).toBe("admin");
	});

	test("changing role calls PATCH with new role", async () => {
		render(<UsersPage />);
		await waitFor(() =>
			expect(screen.getByText("fcampos@grupoconex.net")).toBeDefined()
		);
		const selects = screen.getAllByRole(
			"combobox"
		) as HTMLSelectElement[];
		fireEvent.change(selects[0], { target: { value: "editor" } });
		await waitFor(() => {
			const patch = calls.find((c) => c.init?.method === "PATCH");
			expect(patch).toBeDefined();
			const body = JSON.parse(String(patch!.init!.body));
			expect(body.role).toBe("editor");
		});
	});
});
