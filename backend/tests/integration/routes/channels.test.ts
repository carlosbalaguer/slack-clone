import type { FastifyInstance } from "fastify";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { buildTestApp, closeTestApp } from "../helpers/test-app.js";
import { generateTestUser, uniqueChannelName } from "../helpers/test-data.js";

describe("Channels Routes - Integration", () => {
	let app: FastifyInstance;
	let testUserWorkosId: string;
	let testChannelId: string;

	beforeAll(async () => {
		app = await buildTestApp();

		// ⭐ Crear test user y configurar mock auth
		const appAny = app as any;
		const testUser = generateTestUser();
		const { data: user } = await appAny.supabase
			.from("users")
			.insert(testUser)
			.select()
			.single();

		testUserWorkosId = user.workos_id;
		appAny.setMockUserId(testUserWorkosId);
	});

	afterAll(async () => {
		const appAny = app as any;
		await appAny.supabase
			.from("users")
			.delete()
			.eq("workos_id", testUserWorkosId);

		await closeTestApp(app);
	});

	describe("POST /api/channels", () => {
		it("should create channel with valid data", async () => {
			const channelData = {
				name: uniqueChannelName(),
				description: "Test channel description",
			};

			const response = await app.inject({
				method: "POST",
				url: "/api/channels",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: channelData,
			});

			expect(response.statusCode).toBe(200);

			const body = response.json();
			expect(body).toHaveProperty("channel");
			expect(body.channel.name).toBe(channelData.name);
			expect(body.channel.description).toBe(channelData.description);
		});

		it("should reject channel without name", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/api/channels",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					description: "Test",
				},
			});

			expect(response.statusCode).toBe(400);
		});
	});

	describe("GET /api/channels", () => {
		it("should return channels list", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/channels",
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response.statusCode).toBe(200);

			const body = response.json();
			expect(body).toHaveProperty("channels");
			expect(Array.isArray(body.channels)).toBe(true);
		});
	});

	describe("GET /api/channels/:id", () => {
		beforeEach(async () => {
			// Crear channel para tests
			const response = await app.inject({
				method: "POST",
				url: "/api/channels",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					name: uniqueChannelName(),
					description: "Test channel",
				},
			});

			testChannelId = response.json().channel.id;
		});

		it("should return channel by id", async () => {
			const response = await app.inject({
				method: "GET",
				url: `/api/channels/${testChannelId}`,
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response.statusCode).toBe(200);

			const body = response.json();
			expect(body).toHaveProperty("channel");
			expect(body.channel.id).toBe(testChannelId);
		});

		it("should return 404 for non-existent channel", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";

			const response = await app.inject({
				method: "GET",
				url: `/api/channels/${fakeId}`,
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response.statusCode).toBe(404);
			expect(response.json()).toEqual({ error: "Channel not found" });
		});

		it("should reject invalid UUID", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/channels/invalid-uuid",
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			// Supabase rechaza UUIDs inválidos
			expect(response.statusCode).toBe(404);
		});
	});

	describe("POST /api/channels - Error handling", () => {
		it("should handle database error on insert", async () => {
			const appAny = app as any;

			// Mock database error
			const originalFrom = appAny.supabase.from;
			appAny.supabase.from = vi.fn().mockReturnValue({
				insert: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						single: vi.fn().mockResolvedValue({
							data: null,
							error: { message: "Database error" },
						}),
					}),
				}),
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/channels",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					name: uniqueChannelName(),
					description: "Test",
				},
			});

			expect(response.statusCode).toBe(400);
			expect(response.json()).toEqual({ error: "Failed to create channel" });

			// Restore
			appAny.supabase.from = originalFrom;
		});
	});
});
