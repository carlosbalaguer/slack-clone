import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, closeTestApp } from "../helpers/test-app.js";
import { generateTestUser, uniqueChannelName } from "../helpers/test-data.js";

describe("Messages Routes - Integration", () => {
	let app: FastifyInstance;
	let testChannelId: string;
	let testUserId: string;
	let testUserWorkosId: string;

	beforeAll(async () => {
		app = await buildTestApp();

		const testUser = generateTestUser();

		const appAny = app as any;

		const { data: user, error } = await appAny.supabase
			.from("users")
			.upsert(testUser, { onConflict: "workos_id" })
			.select()
			.single();

		if (error) {
			throw new Error(`Failed to create test user: ${error.message}`);
		}

		testUserId = user.id;
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

	beforeEach(async () => {
		const channelResponse = await app.inject({
			method: "POST",
			url: "/api/channels",
			headers: {
				authorization: "Bearer mock_token",
			},
			payload: {
				name: uniqueChannelName(),
				description: "Channel for testing messages",
			},
		});

		if (channelResponse.statusCode !== 200) {
			throw new Error(
				`Failed to create test channel: ${channelResponse.body}`
			);
		}

		const channelData = channelResponse.json();
		testChannelId = channelData.channel.id;
	});

	describe("POST /api/messages", () => {
		it("should create message with valid data", async () => {
			const messageData = {
				channel_id: testChannelId,
				content: "Hello, World!",
			};

			const response = await app.inject({
				method: "POST",
				url: "/api/messages",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: messageData,
			});

			expect(response.statusCode).toBe(200);

			const body = response.json();
			expect(body).toHaveProperty("message");
			expect(body.message.content).toBe(messageData.content);
			expect(body.message.channel_id).toBe(testChannelId);
		});

		it("should reject empty content", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/api/messages",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					channel_id: testChannelId,
					content: "",
				},
			});

			expect(response.statusCode).toBe(400);
		});

		it("should reject missing channel_id", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/api/messages",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					content: "Test message",
				},
			});

			expect(response.statusCode).toBe(400);
		});

		it("should reject invalid channel_id UUID", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/api/messages",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					channel_id: "invalid-uuid",
					content: "Test message",
				},
			});

			expect(response.statusCode).toBe(400);
		});
	});

	describe("GET /api/messages/channel/:channelId", () => {
		it("should return messages for channel", async () => {
			const response = await app.inject({
				method: "GET",
				url: `/api/messages/channel/${testChannelId}`,
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response.statusCode).toBe(200);

			const body = response.json();
			expect(body).toHaveProperty("messages");
			expect(Array.isArray(body.messages)).toBe(true);
		});

		it("should reject invalid UUID", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/messages/channel/invalid-uuid",
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response.statusCode).toBe(400);
		});

		it("should return cached messages on second request", async () => {
			// Primera request (cache miss)
			const response1 = await app.inject({
				method: "GET",
				url: `/api/messages/channel/${testChannelId}`,
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response1.statusCode).toBe(200);
			expect(response1.json().cached).toBeFalsy();

			// Segunda request (cache hit)
			const response2 = await app.inject({
				method: "GET",
				url: `/api/messages/channel/${testChannelId}`,
				headers: {
					authorization: "Bearer mock_token",
				},
			});

			expect(response2.statusCode).toBe(200);
			expect(response2.json().cached).toBe(true); // ⭐ Línea 32
		});
	});

	describe("POST /api/messages - Advanced features", () => {
		it("should process @mentions in message", async () => {
			const appAny = app as any;

			// Crear otro user para mencionar
			const mentionedUser = generateTestUser();
			const { data: mentioned } = await appAny.supabase
				.from("users")
				.insert(mentionedUser)
				.select()
				.single();

			const messageWithMention = {
				channel_id: testChannelId,
				content: `Hey @${mentioned.username}, check this out!`, // ⭐ Trigger mentions
			};

			const response = await app.inject({
				method: "POST",
				url: "/api/messages",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: messageWithMention,
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().message.content).toContain(
				`@${mentioned.username}`
			);

			// Cleanup
			await appAny.supabase.from("users").delete().eq("id", mentioned.id);
		});

		it("should handle @mention of non-existent user", async () => {
			const messageWithMention = {
				channel_id: testChannelId,
				content: "Hey @nonexistentuser123, check this out!",
			};

			const response = await app.inject({
				method: "POST",
				url: "/api/messages",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: messageWithMention,
			});

			// Should still create message, just skip notification
			expect(response.statusCode).toBe(200);
		});

		it("should handle message without mentions", async () => {
			const messageWithoutMention = {
				channel_id: testChannelId,
				content: "Regular message without any mentions",
			};

			const response = await app.inject({
				method: "POST",
				url: "/api/messages",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: messageWithoutMention,
			});

			expect(response.statusCode).toBe(200);
		});
	});

	describe("POST /api/messages - Error handling", () => {
		it("should return 404 when user not found", async () => {
			const appAny = app as any;

			// Setear workos_id que no existe
			appAny.setMockUserId("nonexistent_workos_id");

			const response = await app.inject({
				method: "POST",
				url: "/api/messages",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					channel_id: testChannelId,
					content: "Test message",
				},
			});

			expect(response.statusCode).toBe(404); // ⭐ Línea 80
			expect(response.json()).toEqual({ error: "User not found" });

			// Restore
			appAny.setMockUserId(testUserWorkosId);
		});

		it("should handle database error on insert", async () => {
			const appAny = app as any;

			// Mock database error
			const originalFrom = appAny.supabase.from;
			let callCount = 0;
			appAny.supabase.from = vi.fn((table: string) => {
				callCount++;

				// Primera llamada: users (ok)
				if (callCount === 1) {
					return originalFrom(table);
				}

				// Segunda llamada: messages (error)
				return {
					insert: vi.fn().mockReturnValue({
						select: vi.fn().mockReturnValue({
							single: vi.fn().mockResolvedValue({
								data: null,
								error: { message: "Database error" }, // ⭐ Línea 99
							}),
						}),
					}),
				};
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/messages",
				headers: {
					authorization: "Bearer mock_token",
				},
				payload: {
					channel_id: testChannelId,
					content: "Test message",
				},
			});

			expect(response.statusCode).toBe(400);
			expect(response.json()).toEqual({ error: "Failed to create message" });

			// Restore
			appAny.supabase.from = originalFrom;
		});
	});
});
