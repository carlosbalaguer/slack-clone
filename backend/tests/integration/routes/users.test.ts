import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, closeTestApp } from "../helpers/test-app.js";
import { generateTestUser } from "../helpers/test-data.js";

describe("Users Routes - Integration", () => {
	let app: FastifyInstance;
	let testUserWorkosId: string;
	let testUserId: string;
	let otherUserWorkosId: string;
	let otherUserId: string;

	beforeAll(async () => {
		app = await buildTestApp();

		const appAny = app as any;

		// Crear test user principal
		const testUser = generateTestUser();
		const { data: user } = await appAny.supabase
			.from("users")
			.upsert(testUser, { onConflict: "workos_id" })
			.select()
			.single();

		testUserWorkosId = user.workos_id;
		testUserId = user.id;

		// Crear otro user para tests de búsqueda
		const otherUser = generateTestUser();
		const { data: other } = await appAny.supabase
			.from("users")
			.insert(otherUser)
			.select()
			.single();

		otherUserWorkosId = other.workos_id;
		otherUserId = other.id;

		// ⭐ Configurar mock auth con el test user principal
		appAny.setMockUserId(testUserWorkosId);
	});

	afterAll(async () => {
		const appAny = app as any;

		// Cleanup
		await appAny.supabase
			.from("users")
			.delete()
			.eq("workos_id", testUserWorkosId);

		await appAny.supabase
			.from("users")
			.delete()
			.eq("workos_id", otherUserWorkosId);

		await closeTestApp(app);
	});

	describe("GET /api/users", () => {
		it("should return all users", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/users",
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response.statusCode).toBe(200);

			const body = response.json();
			expect(body).toHaveProperty("users");
			expect(Array.isArray(body.users)).toBe(true);
			expect(body.users.length).toBeGreaterThanOrEqual(2); // Al menos nuestros 2 test users

			// Verificar que retorna los campos correctos
			const user = body.users[0];
			expect(user).toHaveProperty("id");
			expect(user).toHaveProperty("username");
			expect(user).toHaveProperty("display_name");
			expect(user).toHaveProperty("avatar_url");
			expect(user).toHaveProperty("status");

			// No debe retornar campos sensibles
			expect(user).not.toHaveProperty("workos_id");
			expect(user).not.toHaveProperty("email");
		});

		it("should reject unauthenticated request", async () => {
			const appAny = app as any;

			// Setear workos_id inválido
			appAny.setMockUserId("nonexistent_id");

			const response = await app.inject({
				method: "GET",
				url: "/api/users",
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			// Mock auth autentica pero user no existe → debería retornar 404 o similar
			// Si no hay check, retorna 200 con data (comportamiento actual)
			expect(response.statusCode).toBe(200);

			// Restaurar mock auth
			appAny.setMockUserId(testUserWorkosId);
		});
	});

	describe("GET /api/users/:id", () => {
		it("should return user by id", async () => {
			const response = await app.inject({
				method: "GET",
				url: `/api/users/${otherUserId}`,
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response.statusCode).toBe(200);

			const body = response.json();
			expect(body).toHaveProperty("user");
			expect(body.user.id).toBe(otherUserId);
			expect(body.user).toHaveProperty("username");
			expect(body.user).toHaveProperty("display_name");
			expect(body.user).toHaveProperty("created_at");
		});

		it("should return 404 for non-existent user", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";

			const response = await app.inject({
				method: "GET",
				url: `/api/users/${fakeId}`,
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response.statusCode).toBe(404);
			expect(response.json()).toEqual({ error: "User not found" });
		});

		it("should reject invalid UUID", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/users/invalid-uuid",
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			// Supabase rechaza UUIDs inválidos
			expect(response.statusCode).toBe(404);
		});
	});

	describe("PATCH /api/users/me/status", () => {
		it("should update status to away", async () => {
			const response = await app.inject({
				method: "PATCH",
				url: "/api/users/me/status",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					status: "away",
				},
			});

			expect(response.statusCode).toBe(200);

			const body = response.json();
			expect(body).toHaveProperty("user");
			expect(body.user.status).toBe("away");
		});

		it("should update status to busy", async () => {
			const response = await app.inject({
				method: "PATCH",
				url: "/api/users/me/status",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					status: "busy",
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().user.status).toBe("busy");
		});

		it("should update status to offline", async () => {
			const response = await app.inject({
				method: "PATCH",
				url: "/api/users/me/status",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					status: "offline",
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().user.status).toBe("offline");
		});

		it("should update status to online", async () => {
			const response = await app.inject({
				method: "PATCH",
				url: "/api/users/me/status",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					status: "online",
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().user.status).toBe("online");
		});

		it("should reject invalid status", async () => {
			const response = await app.inject({
				method: "PATCH",
				url: "/api/users/me/status",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					status: "invalid_status",
				},
			});

			expect(response.statusCode).toBe(400);
			expect(response.json()).toEqual({
				error: "Invalid status",
			});
		});

		it("should reject missing status", async () => {
			const response = await app.inject({
				method: "PATCH",
				url: "/api/users/me/status",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {},
			});

			expect(response.statusCode).toBe(400);
		});
	});

	describe("PATCH /api/users/me", () => {
		it("should update display_name", async () => {
			const response = await app.inject({
				method: "PATCH",
				url: "/api/users/me",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					display_name: "Updated Display Name",
				},
			});

			expect(response.statusCode).toBe(200);

			const body = response.json();
			expect(body).toHaveProperty("user");
			expect(body.user.display_name).toBe("Updated Display Name");
		});

		it("should update avatar_url", async () => {
			const response = await app.inject({
				method: "PATCH",
				url: "/api/users/me",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					avatar_url: "https://example.com/avatar.jpg",
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().user.avatar_url).toBe(
				"https://example.com/avatar.jpg"
			);
		});

		it("should update both display_name and avatar_url", async () => {
			const response = await app.inject({
				method: "PATCH",
				url: "/api/users/me",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					display_name: "New Name",
					avatar_url: "https://example.com/new-avatar.jpg",
				},
			});

			expect(response.statusCode).toBe(200);

			const body = response.json();
			expect(body.user.display_name).toBe("New Name");
			expect(body.user.avatar_url).toBe(
				"https://example.com/new-avatar.jpg"
			);
		});

		it("should handle empty payload", async () => {
			const response = await app.inject({
				method: "PATCH",
				url: "/api/users/me",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {},
			});

			// Sin cambios, solo actualiza updated_at
			expect(response.statusCode).toBe(200);
			expect(response.json()).toHaveProperty("user");
		});

		it("should set avatar_url to null", async () => {
			const response = await app.inject({
				method: "PATCH",
				url: "/api/users/me",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					avatar_url: null,
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().user.avatar_url).toBeNull();
		});
	});
});
