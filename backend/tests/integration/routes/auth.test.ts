import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildTestApp, closeTestApp } from "../helpers/test-app.js";

describe("Auth Routes - Magic Link", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	describe("POST /api/auth/magic-link", () => {
		it("should send magic link with valid email", async () => {
			const appAny = app as any;

			// ⭐ Mock workosClient
			const mockSendMagicLink = vi.fn().mockResolvedValue({
				id: "magic_123",
				email: "test@example.com",
			});

			vi.spyOn(appAny.workosClient, "sendMagicLink").mockImplementation(
				mockSendMagicLink
			);

			const response = await app.inject({
				method: "POST",
				url: "/api/auth/magic-link",
				payload: {
					email: "test@example.com",
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				message: "Magic link sent to your email",
			});
			expect(mockSendMagicLink).toHaveBeenCalledWith("test@example.com");

			vi.restoreAllMocks();
		});

		it("should reject invalid email", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/api/auth/magic-link",
				payload: {
					email: "invalid-email",
				},
			});

			expect(response.statusCode).toBe(400);
		});

		it("should handle WorkOS API failure", async () => {
			const appAny = app as any;

			// Mock failure
			vi.spyOn(appAny.workosClient, "sendMagicLink").mockRejectedValue(
				new Error("WorkOS API error")
			);

			const response = await app.inject({
				method: "POST",
				url: "/api/auth/magic-link",
				payload: {
					email: "test@example.com",
				},
			});

			expect(response.statusCode).toBe(400);
			expect(response.json()).toEqual({
				error: "Failed to send magic link",
			});

			vi.restoreAllMocks();
		});

		it("should return 503 when circuit breaker is open", async () => {
			const appAny = app as any;

			// ✅ Mock circuit breaker abierto
			vi.spyOn(appAny.workosClient, "sendMagicLink").mockRejectedValue(
				new Error("Authentication service temporarily unavailable")
			);

			const response = await app.inject({
				method: "POST",
				url: "/api/auth/magic-link",
				payload: {
					email: "test@example.com",
				},
			});

			expect(response.statusCode).toBe(503);
			expect(response.json()).toEqual({
				error: "Authentication service temporarily unavailable. Please try again later.",
			});

			vi.restoreAllMocks();
		});
	});

	describe("POST /api/auth/verify", () => {
		it("should verify magic link and create new user", async () => {
			const appAny = app as any;

			// Mock WorkOS authenticateWithMagicAuth
			const mockAuth = vi.fn().mockResolvedValue({
				user: {
					id: "workos_user_123",
					email: "newuser@example.com",
					firstName: "New",
					lastName: "User",
					profilePictureUrl: "https://example.com/pic.jpg",
				},
				accessToken: "access_token_123",
				refreshToken: "refresh_token_123",
			});

			vi.spyOn(
				appAny.workos.userManagement,
				"authenticateWithMagicAuth"
			).mockImplementation(mockAuth);

			const response = await app.inject({
				method: "POST",
				url: "/api/auth/verify",
				payload: {
					email: "newuser@example.com",
					code: "123456",
				},
			});

			expect(response.statusCode).toBe(200);

			const body = response.json();
			expect(body).toHaveProperty("user");
			expect(body).toHaveProperty("accessToken");
			expect(body).toHaveProperty("refreshToken");
			expect(body.user.email).toBe("newuser@example.com");

			vi.restoreAllMocks();
		});

		it("should verify magic link and return existing user", async () => {
			const appAny = app as any;

			const timestamp = Date.now();
			const uniqueEmail = `existing-${timestamp}@example.com`;

			const expectedWorkosId = `workos_existing-${timestamp}`;

			const { data: existingUser, error: insertError } =
				await appAny.supabase
					.from("users")
					.insert({
						workos_id: expectedWorkosId, // ⭐ Coincidir exactamente
						email: uniqueEmail,
						username: `existing${timestamp}`,
						display_name: "Existing User",
					})
					.select()
					.single();

			if (insertError || !existingUser) {
				throw new Error(
					`Failed to create existing user: ${insertError?.message}`
				);
			}

			vi.spyOn(
				appAny.workosClient,
				"authenticateWithCode"
			).mockResolvedValue({
				user: {
					id: expectedWorkosId,
					email: uniqueEmail,
					firstName: "Existing",
					lastName: "User",
				},
				accessToken: "access_token_123",
				refreshToken: "refresh_token_123",
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/auth/verify",
				payload: {
					email: existingUser.email, // ⭐ Usar email del user creado
					code: "123456",
				},
			});

			expect(response.statusCode).toBe(200);

			const body = response.json();
			expect(body.user.email).toBe(existingUser.email);

			// Cleanup
			await appAny.supabase
				.from("users")
				.delete()
				.eq("workos_id", expectedWorkosId);
		});

		it("should reject invalid code", async () => {
			const appAny = app as any;

			// Mock WorkOS failure
			vi.spyOn(
				appAny.workosClient,
				"authenticateWithCode"
			).mockRejectedValue(new Error("Invalid code"));

			const response = await app.inject({
				method: "POST",
				url: "/api/auth/verify",
				payload: {
					email: "test@example.com",
					code: "wrong2",
				},
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toEqual({
				error: "Invalid code",
			});

			vi.restoreAllMocks();
		});

		it("should reject invalid email format", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/api/auth/verify",
				payload: {
					email: "invalid",
					code: "123456",
				},
			});

			expect(response.statusCode).toBe(400);
		});

		it("should return 503 when circuit breaker is open", async () => {
			const appAny = app as any;

			// ✅ Mock circuit breaker abierto
			vi.spyOn(
				appAny.workosClient,
				"authenticateWithCode"
			).mockRejectedValue(
				new Error("Authentication service temporarily unavailable")
			);

			const response = await app.inject({
				method: "POST",
				url: "/api/auth/verify",
				payload: {
					email: "test@example.com",
					code: "123456",
				},
			});

			expect(response.statusCode).toBe(503);
			expect(response.json()).toEqual({
				error: "Authentication service temporarily unavailable. Please try again later.",
			});

			vi.restoreAllMocks();
		});
	});

	describe("POST /api/auth/refresh", () => {
		it("should send magic link with valid email", async () => {
			const appAny = app as any;

			// ✅ Mock workosClient en vez de workos
			const mockSendMagicLink = vi.fn().mockResolvedValue({
				id: "magic_123",
				email: "test@example.com",
			});

			vi.spyOn(appAny.workosClient, "sendMagicLink").mockImplementation(
				mockSendMagicLink
			);

			const response = await app.inject({
				method: "POST",
				url: "/api/auth/magic-link",
				payload: {
					email: "test@example.com",
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				message: "Magic link sent to your email",
			});
			expect(mockSendMagicLink).toHaveBeenCalledWith("test@example.com");

			vi.restoreAllMocks();
		});

		it("should reject invalid refresh token", async () => {
			const appAny = app as any;

			// Mock WorkOS failure
			vi.spyOn(
				appAny.workos.userManagement,
				"authenticateWithRefreshToken"
			).mockRejectedValue(new Error("Invalid refresh token"));

			const response = await app.inject({
				method: "POST",
				url: "/api/auth/refresh",
				payload: {
					refreshToken: "invalid_token",
				},
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toEqual({
				error: "Invalid refresh token",
			});

			vi.restoreAllMocks();
		});

		it("should reject missing refresh token", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/api/auth/refresh",
				payload: {},
			});

			expect(response.statusCode).toBe(400);
		});
	});

	describe("GET /api/auth/me", () => {
		it("should return current user", async () => {
			const appAny = app as any;

			const uniqueWorkosId = `user_test_${Date.now()}`;
			const uniqueEmail = `me-${Date.now()}@example.com`;

			const { data: testUser, error: insertError } = await appAny.supabase
				.from("users")
				.insert({
					workos_id: uniqueWorkosId,
					email: uniqueEmail,
					username: `metest${Date.now()}`,
					display_name: "Me Test",
				})
				.select()
				.single();

			if (insertError || !testUser) {
				throw new Error(
					`Failed to create test user: ${insertError?.message}`
				);
			}

			appAny.setMockUserId(testUser.workos_id);

			const response = await app.inject({
				method: "GET",
				url: "/api/auth/me",
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toHaveProperty("user");
			expect(response.json().user).not.toBeNull();
			expect(response.json().user.email).toBe(uniqueEmail);

			// Cleanup
			await appAny.supabase
				.from("users")
				.delete()
				.eq("workos_id", uniqueWorkosId);
		});

		it("should return null user when workos_id not found", async () => {
			const appAny = app as any;

			appAny.setMockUserId("nonexistent_workos_id_123");

			const response = await app.inject({
				method: "GET",
				url: "/api/auth/me",
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response.statusCode).toBe(404);
			expect(response.json()).toEqual({ error: "User not found" });
		});
	});
});
