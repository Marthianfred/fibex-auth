import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RolesPage } from "../RolesPage";

const ROLES_FIXTURE = [
	{
		id: "r1",
		name: "viewer",
		description: "Read only",
		permissions: { user: ["read", "list"] },
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
	},
	{
		id: "r2",
		name: "super_admin",
		description: "Full access",
		permissions: {
			user: [
				"create",
				"read",
				"list",
				"update",
				"delete",
				"ban",
				"unban",
				"impersonate",
				"set-password",
				"set-role",
			],
		},
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
	},
];

// ---------- fetch stub ----------
let calls: { url: string; init?: RequestInit }[] = [];
let listResponse: any = { status: 200, body: { roles: ROLES_FIXTURE } };
let mutationResponse: any = { status: 200, body: {} };

const originalFetch = globalThis.fetch;

beforeEach(() => {
	calls = [];
	listResponse = { status: 200, body: { roles: ROLES_FIXTURE } };
	mutationResponse = { status: 200, body: {} };

	globalThis.fetch = (async (url: any, init?: RequestInit) => {
		calls.push({ url: String(url), init });
		// GET = list, others = mutation
		const method = init?.method || "GET";
		const response = method === "GET" ? listResponse : mutationResponse;
		return new Response(JSON.stringify(response.body), {
			status: response.status,
			headers: { "Content-Type": "application/json" },
		});
	}) as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	document.body.innerHTML = "";
});

// ============================================================
// RENDER
// ============================================================
describe("RolesPage rendering", () => {
	test("renders page title", async () => {
		render(<RolesPage />);
		expect(screen.getByText("Roles & Permissions")).toBeDefined();
	});

	test("shows loading initially then roles", async () => {
		render(<RolesPage />);
		expect(screen.getByText(/Loading/i)).toBeDefined();
		await waitFor(() => {
			expect(screen.getByText("viewer")).toBeDefined();
			expect(screen.getByText("super_admin")).toBeDefined();
		});
	});

	test("fetches from /api/admin/custom-roles on mount", async () => {
		render(<RolesPage />);
		await waitFor(() => expect(calls.length).toBeGreaterThan(0));
		expect(calls[0].url).toBe("/api/admin/custom-roles");
	});

	test("shows error banner when list fails", async () => {
		listResponse = { status: 403, body: { error: "Forbidden" } };
		render(<RolesPage />);
		await waitFor(() => expect(screen.getByText("Forbidden")).toBeDefined());
	});

	test("super_admin row has Save button disabled", async () => {
		render(<RolesPage />);
		await waitFor(() => expect(screen.getByText("super_admin")).toBeDefined());
		const saveButtons = screen.getAllByRole("button", { name: /Save/ });
		// viewer save = enabled, super_admin save = disabled
		const superAdminSave = saveButtons.find((b) =>
			(b as HTMLButtonElement).disabled
		);
		expect(superAdminSave).toBeDefined();
	});
});

// ============================================================
// PERMISSION TOGGLING
// ============================================================
describe("RolesPage permission toggling", () => {
	test("clicking unchecked permission checks it", async () => {
		render(<RolesPage />);
		await waitFor(() => expect(screen.getByText("viewer")).toBeDefined());

		// viewer currently has user.read and user.list; user.delete is NOT checked
		const checkboxes = screen.getAllByRole(
			"checkbox"
		) as HTMLInputElement[];

		// Find the unchecked checkbox for the viewer row + "delete" action
		// We search by adjacency: label text is "delete" near a checkbox
		const deleteCheckboxes = checkboxes.filter((cb) => {
			const label = cb.closest("label");
			return label?.textContent?.includes("delete");
		});
		// The first one belongs to viewer (rendered first)
		const viewerDelete = deleteCheckboxes[0];
		expect(viewerDelete.checked).toBe(false);

		fireEvent.click(viewerDelete);
		expect(viewerDelete.checked).toBe(true);
	});
});

// ============================================================
// CREATE ROLE
// ============================================================
describe("RolesPage create role", () => {
	test("clicking New Role shows form", async () => {
		render(<RolesPage />);
		await waitFor(() => expect(screen.getByText("viewer")).toBeDefined());

		fireEvent.click(screen.getByText("New Role"));
		expect(screen.getByPlaceholderText(/Role name/i)).toBeDefined();
	});

	test("submitting empty name does nothing", async () => {
		render(<RolesPage />);
		await waitFor(() => expect(screen.getByText("viewer")).toBeDefined());
		fireEvent.click(screen.getByText("New Role"));

		const before = calls.length;
		fireEvent.click(screen.getByText("Create"));
		// no extra fetch
		await new Promise((r) => setTimeout(r, 50));
		expect(calls.length).toBe(before);
	});

	test("submitting valid name posts to /api/admin/custom-roles", async () => {
		mutationResponse = { status: 201, body: { role: { id: "r3" } } };
		render(<RolesPage />);
		await waitFor(() => expect(screen.getByText("viewer")).toBeDefined());

		fireEvent.click(screen.getByText("New Role"));
		const nameInput = screen.getByPlaceholderText(/Role name/i);
		fireEvent.change(nameInput, { target: { value: "supervisor" } });
		fireEvent.click(screen.getByText("Create"));

		await waitFor(() => {
			const post = calls.find((c) => c.init?.method === "POST");
			expect(post).toBeDefined();
			expect(post!.url).toBe("/api/admin/custom-roles");
			const body = JSON.parse(String(post!.init!.body));
			expect(body.name).toBe("supervisor");
		});
	});
});
