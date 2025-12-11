import type { FastifyInstance } from "fastify";
import type { Socket as ClientSocket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, closeTestApp } from "../helpers/test-app.js";
import { createTestChannel, createTestUser } from "../helpers/test-data.js";
import {
	createTestWebSocketClient,
	waitForEvent,
} from "../helpers/test-websocket.js";

describe("WebSocket Integration", () => {
	let app: FastifyInstance;
	let testUserId: string;
	let testChannelId: string;

	let activeSockets: ClientSocket[] = [];

	const createTrackedClient = async (userId: string) => {
		const socket = await createTestWebSocketClient(app, userId);
		activeSockets.push(socket);
		return socket;
	};

	beforeAll(async () => {
		app = await buildTestApp({
			enableWebSocket: true,
		});
		await app.listen({ port: 0 });

		// Create test user
		const testUser = createTestUser();
		const { data: user } = await app.supabase
			.from("users")
			.insert(testUser)
			.select()
			.single();
		testUserId = user!.id;

		// Create test channel
		const testChannel = createTestChannel(testUser.username);
		const { data: channel } = await app.supabase
			.from("channels")
			.insert(testChannel)
			.select()
			.single();
		testChannelId = channel!.id;
	}, 30000);

	afterAll(async () => {
		// Desconectar sockets clientes
		for (const socket of activeSockets) {
			if (socket.connected) {
				socket.disconnect();
			}
		}
		activeSockets = [];

		// Esperar a que los sockets se cierren
		await new Promise((resolve) => setTimeout(resolve, 100));

		await closeTestApp(app);
	}, 30000);

	// ========================================
	// Authentication Tests
	// ========================================
	describe("Authentication", () => {
		it("should reject connection without token", async () => {
			const address = await app.server.address();
			if (!address || typeof address !== "object") {
				throw new Error("Server not listening");
			}

			const port = address.port;
			const { io: ioClient } = await import("socket.io-client");

			const client = ioClient(`http://localhost:${port}`, {
				auth: {},
				transports: ["websocket"],
				reconnection: false,
			});

			await expect(
				new Promise((resolve) => {
					client.on("connect_error", (err) => resolve(err.message));
					client.on("connect", () => resolve("connected"));
					setTimeout(() => resolve("timeout"), 2000);
				})
			).resolves.toContain("Authentication required");

			client.close();
		});

		it("should reject connection with invalid token", async () => {
			const address = app.server.address();
			if (!address || typeof address !== "object") {
				throw new Error("Server not listening");
			}

			const port = address.port;
			const { io: ioClient } = await import("socket.io-client");

			const client = ioClient(`http://localhost:${port}`, {
				auth: { token: "invalid-token" },
				transports: ["websocket"],
				reconnection: false,
			});

			await expect(
				new Promise((resolve) => {
					client.on("connect_error", (err) => resolve(err.message));
					client.on("connect", () => resolve("connected"));
					setTimeout(() => resolve("timeout"), 2000);
				})
			).resolves.toContain("Authentication failed");

			client.close();
		});

		it("should accept connection with valid token", async () => {
			const client = await createTrackedClient(testUserId);
			expect(client.connected).toBe(true);
			client.disconnect();
		});
	});

	// ========================================
	// Channel Operations
	// ========================================
	describe("Channel Operations", () => {
		let client: ClientSocket;

		beforeAll(async () => {
			client = await createTestWebSocketClient(app, testUserId);
		});

		afterAll(() => {
			if (client?.connected) {
				client.disconnect();
			}
		});

		it("should allow joining a channel", async () => {
			client.emit("join_channel", testChannelId);
			// Esperamos un poco porque ahora join consulta DB
			await new Promise((resolve) => setTimeout(resolve, 200));
			expect(client.connected).toBe(true);
		});

		it("should allow leaving a channel", async () => {
			client.emit("join_channel", testChannelId);
			await new Promise((resolve) => setTimeout(resolve, 200));

			client.emit("leave_channel", testChannelId);
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(client.connected).toBe(true);
		});
	});

	// ========================================
	// Message Broadcasting
	// ========================================
	describe("Message Broadcasting", () => {
		let client1: ClientSocket;
		let client2: ClientSocket;
		let user2Id: string;

		beforeAll(async () => {
			const testUser2 = createTestUser();
			const { data: user2 } = await app.supabase
				.from("users")
				.insert(testUser2)
				.select()
				.single();
			user2Id = user2!.id;

			client1 = await createTestWebSocketClient(app, testUserId);
			client2 = await createTestWebSocketClient(app, user2Id);

			client1.emit("join_channel", testChannelId);
			client2.emit("join_channel", testChannelId);

			await new Promise((resolve) => setTimeout(resolve, 1000));
		}, 30000);

		afterAll(() => {
			if (client1?.connected) client1.disconnect();
			if (client2?.connected) client2.disconnect();
		});

		it("should broadcast new message to channel members", async () => {
			const messagePayload = {
				channelId: testChannelId,
				content: "Hello everyone!",
			};

			const messagePromise = waitForEvent(client2, "new_message");

			client1.emit("send_message", messagePayload);

			const receivedMessage = await messagePromise;

			expect(receivedMessage).toMatchObject({
				content: "Hello everyone!",
				channel_id: testChannelId,
				user_id: testUserId,
			});
			expect(receivedMessage).toHaveProperty("id");
		});

		it("should not broadcast message to users not in channel", async () => {
			const testUser3 = createTestUser();
			const { data: user3 } = await app.supabase
				.from("users")
				.insert(testUser3)
				.select()
				.single();

			const client3 = await createTestWebSocketClient(app, user3!.id);
			// client3 NO se une al canal

			const messagePayload = {
				channelId: testChannelId,
				content: "Secret message",
			};

			let received = false;
			client3.on("new_message", () => {
				received = true;
			});

			client1.emit("send_message", messagePayload);

			await new Promise((resolve) => setTimeout(resolve, 500));

			expect(received).toBe(false);
			client3.disconnect();
		});
	});

	// ========================================
	// Typing Indicators
	// ========================================
	describe("Typing Indicators", () => {
		let client1: ClientSocket;
		let client2: ClientSocket;
		let user2Id: string;

		beforeAll(async () => {
			const testUser2 = createTestUser();
			const { data: user2 } = await app.supabase
				.from("users")
				.insert(testUser2)
				.select()
				.single();
			user2Id = user2!.id;

			client1 = await createTestWebSocketClient(app, testUserId);
			client2 = await createTestWebSocketClient(app, user2Id);

			client1.emit("join_channel", testChannelId);
			client2.emit("join_channel", testChannelId);

			await new Promise((resolve) => setTimeout(resolve, 2000));
		}, 30000);

		afterAll(() => {
			if (client1?.connected) client1.disconnect();
			if (client2?.connected) client2.disconnect();
		});

		it("should broadcast typing_start event", async () => {
			const typingPromise = waitForEvent(client2, "user_typing");

			await new Promise((resolve) => setTimeout(resolve, 100));

			client1.emit("typing_start", { channelId: testChannelId });

			const typingData = await typingPromise;

			expect(typingData).toHaveProperty("userId");
			expect(typingData).toHaveProperty("username");
		}, 10000);

		it("should broadcast typing_stop event", async () => {
			const stoppedPromise = waitForEvent(client2, "user_stopped_typing");

			client1.emit("typing_stop", { channelId: testChannelId });

			const stoppedData = await stoppedPromise;
			expect(stoppedData).toHaveProperty("userId");
		}, 10000);
	});

	// ========================================
	// Disconnect
	// ========================================
	describe("Disconnect", () => {
		it("should handle client disconnect gracefully", async () => {
			const client = await createTestWebSocketClient(app, testUserId);
			expect(client.connected).toBe(true);

			client.disconnect();
			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(client.connected).toBe(false);
		});
	});
});
