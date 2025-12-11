import type { FastifyInstance } from "fastify";
import type { Server, Socket } from "socket.io";
import { channelService } from "../services/channel.service.js";
import { messageService } from "../services/message.service.js";
import { userService } from "../services/user.service.js";

interface ServerToClientEvents {
	new_message: (message: any) => void;
	user_typing: (data: { userId: string; username: string }) => void;
	user_stopped_typing: (data: { userId: string }) => void;
	error: (error: { message: string }) => void;
}

interface ClientToServerEvents {
	join_channel: (channelId: string) => void;
	leave_channel: (channelId: string) => void;
	send_message: (
		data: { channelId: string; content: string },
		callback?: (response: any) => void
	) => void;
	typing_start: (data: { channelId: string }) => void;
	typing_stop: (data: { channelId: string }) => void;
}

interface SocketData {
	userId: string;
	username: string;
	workosId: string;
}

export function setupWebSocket(
	io: Server<ClientToServerEvents, ServerToClientEvents>,
	fastify: FastifyInstance
) {
	// Auth middleware
	io.use(async (socket, next) => {
		const token = socket.handshake.auth.token;

		if (!token) {
			return next(new Error("Authentication required"));
		}

		try {
			const workos = (fastify as any).workos;

			const workosUser = await workos.userManagement.getUser(token);

			if (!workosUser) {
				return next(new Error("Invalid token"));
			}

			// Get user from DB
			const dbUser = await userService.findByWorkosId(
				fastify,
				workosUser.id
			);

			if (!dbUser) {
				return next(new Error("User not found"));
			}

			socket.data = {
				userId: dbUser.id,
				username: dbUser.username,
				workosId: workosUser.id,
			} as SocketData;

			next();
		} catch (err) {
			fastify.log.error({ err }, "WebSocket Auth Error");
			next(new Error("Authentication failed"));
		}
	});

	io.on("connection", (socket: Socket) => {
		const { username, userId, workosId } = socket.data as SocketData;
		fastify.log.info(`✅ WS User connected: ${username} (${socket.id})`);
		// Join channel
		socket.on("join_channel", async (channelId) => {
			try {
				const channel = await channelService.findById(
					fastify,
					channelId
				);

				if (!channel) {
					socket.emit("error", { message: "Channel does not exist" });
					return;
				}

				const roomName = `channel:${channelId}`;
				socket.join(roomName);
				fastify.log.debug(`Socket ${username} joined ${roomName}`);
			} catch (err) {
				fastify.log.error({ err }, "Error joining channel");
			}
		});

		// Leave channel
		socket.on("leave_channel", (channelId) => {
			const roomName = `channel:${channelId}`;
			socket.leave(roomName);
			fastify.log.debug(`${username} left channel: ${channelId}`);
		});

		// New message
		socket.on("send_message", async ({ channelId, content }, callback) => {
			try {
				const message = await messageService.create(fastify, {
					content,
					channelId,
					workosUserId: workosId,
				});

				io.to(`channel:${channelId}`).emit("new_message", message);

				if (callback) {
					callback({ status: "ok", data: message });
				}
			} catch (err: any) {
				fastify.log.error({ err }, "WS Message Error");

				socket.emit("error", { message: "Failed to send message" });

				if (callback) {
					callback({
						status: "error",
						error: "Failed to save message",
					});
				}
			}
		});

		// Typing indicator
		socket.on("typing_start", ({ channelId }) => {
			socket.to(`channel:${channelId}`).emit("user_typing", {
				userId: userId,
				username: username,
			});
		});

		socket.on("typing_stop", ({ channelId }) => {
			socket.to(`channel:${channelId}`).emit("user_stopped_typing", {
				userId: userId,
			});
		});

		// Disconnect
		socket.on("disconnect", () => {
			fastify.log.debug(`User disconnected: ${username}`);
		});
	});
}
