import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, closeTestApp } from "./helpers/test-app.js";

describe("Security Headers", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	describe("Helmet Headers", () => {
		it("should include X-Content-Type-Options header", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
			});

			expect(response.headers["x-content-type-options"]).toBe("nosniff");
		});

		it("should include X-Frame-Options header", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
			});

			expect(response.headers["x-frame-options"]).toBe("DENY");
		});

		it("should include Referrer-Policy header", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
			});

			expect(response.headers["referrer-policy"]).toBe(
				"strict-origin-when-cross-origin"
			);
		});

		it("should include Content-Security-Policy header", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
			});

			expect(response.headers["content-security-policy"]).toBeDefined();
			expect(response.headers["content-security-policy"]).toContain(
				"default-src 'self'"
			);
		});

		it("should include Cross-Origin policies", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
			});

			expect(
				response.headers["cross-origin-opener-policy"]
			).toBeDefined();
			expect(
				response.headers["cross-origin-resource-policy"]
			).toBeDefined();
		});

		it("should not include HSTS header in test environment", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
			});

			// HSTS solo en producción
			expect(
				response.headers["strict-transport-security"]
			).toBeUndefined();
		});
	});

	describe("Custom Security Headers", () => {
		it("should include Permissions-Policy header", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
			});

			expect(response.headers["permissions-policy"]).toBeDefined();
			expect(response.headers["permissions-policy"]).toContain(
				"geolocation=()"
			);
			expect(response.headers["permissions-policy"]).toContain(
				"camera=()"
			);
			expect(response.headers["permissions-policy"]).toContain(
				"microphone=()"
			);
		});

		it("should not include Server header", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
			});

			expect(response.headers["server"]).toBeUndefined();
			expect(response.headers["x-powered-by"]).toBeUndefined();
		});

		it("should include X-Robots-Tag for API routes", async () => {
			const appAny = app as any;

			// Setup mock user
			const { data: testUser } = await appAny.supabase
				.from("users")
				.insert({
					workos_id: `user_test_${Date.now()}`,
					email: `test-${Date.now()}@example.com`,
					username: `test${Date.now()}`,
					display_name: "Test User",
				})
				.select()
				.single();

			appAny.setMockUserId(testUser.workos_id);

			const response = await app.inject({
				method: "GET",
				url: "/api/v1/users",
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response.headers["x-robots-tag"]).toBe("noindex, nofollow");

			// Cleanup
			await appAny.supabase
				.from("users")
				.delete()
				.eq("workos_id", testUser.workos_id);
		});

		it("should include no-cache headers for auth routes", async () => {
			const appAny = app as any;

			// Setup mock user
			const { data: testUser } = await appAny.supabase
				.from("users")
				.insert({
					workos_id: `user_test_${Date.now()}`,
					email: `test-${Date.now()}@example.com`,
					username: `test${Date.now()}`,
					display_name: "Test User",
				})
				.select()
				.single();

			appAny.setMockUserId(testUser.workos_id);

			const response = await app.inject({
				method: "GET",
				url: "/api/v1/auth/me",
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response.headers["cache-control"]).toContain("no-store");
			expect(response.headers["cache-control"]).toContain("no-cache");
			expect(response.headers["pragma"]).toBe("no-cache");
			expect(response.headers["expires"]).toBe("0");

			// Cleanup
			await appAny.supabase
				.from("users")
				.delete()
				.eq("workos_id", testUser.workos_id);
		});

		it("should NOT include no-cache headers for non-sensitive routes", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
			});

			// Health no es ruta sensible, puede tener cache
			expect(response.headers["cache-control"]).toBeUndefined();
		});
	});

	describe("CSP Directives", () => {
		it("should allow connections to required external services", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
			});

			const csp = response.headers["content-security-policy"] as string;

			// Verificar servicios externos permitidos
			expect(csp).toContain("https://*.supabase.co");
			expect(csp).toContain("https://*.upstash.io");
		});

		it("should block frames", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
			});

			const csp = response.headers["content-security-policy"] as string;

			expect(csp).toContain("frame-src 'none'");
		});

		it("should block objects", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
			});

			const csp = response.headers["content-security-policy"] as string;

			expect(csp).toContain("object-src 'none'");
		});
	});
});
