import { WorkOS } from "@workos-inc/node";
import type { FastifyInstance } from "fastify";
import type { Server, Socket } from "socket.io";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

interface SocketData {
	userId: string;
	username: string;
}

export function setupWebSocket(io: Server, fastify: FastifyInstance) {
	// Auth middleware
	io.use(async (socket, next) => {
		const token = socket.handshake.auth.token;

		if (!token) {
			return next(new Error("Authentication required"));
		}

		try {
			const workos = (fastify as any).workos;

			const user = await workos.userManagement.getUser(token);

			if (!user) {
				return next(new Error("Invalid token"));
			}

			// Get user from DB
			const { data: dbUser } = await fastify.supabase
				.from("users")
				.select("*")
				.eq("workos_id", user.id)
				.single();

			if (!dbUser) {
				return next(new Error("User not found"));
			}

			socket.data = {
				userId: dbUser.id,
				username: dbUser.username,
			} as SocketData;

			next();
		} catch (err) {
			next(new Error("Authentication failed"));
		}
	});

	io.on("connection", (socket: Socket) => {
		const data = socket.data as SocketData;

		console.log(`✅ User connected: ${data.username} (${socket.id})`);

		// Join channel
		socket.on("join-channel", (channelId: string) => {
			socket.join(`channel:${channelId}`);
			console.log(`${data.username} joined channel: ${channelId}`);
		});

		// Leave channel
		socket.on("leave-channel", (channelId: string) => {
			socket.leave(`channel:${channelId}`);
			console.log(`${data.username} left channel: ${channelId}`);
		});

		// New message
		socket.on("new-message", async (message) => {
			// Broadcast to channel
			io.to(`channel:${message.channel_id}`).emit("message", message);
		});

		// Typing indicator
		socket.on("typing-start", ({ channelId }) => {
			socket.to(`channel:${channelId}`).emit("user-typing", {
				userId: data.userId,
				username: data.username,
			});
		});

		socket.on("typing-stop", ({ channelId }) => {
			socket.to(`channel:${channelId}`).emit("user-stopped-typing", {
				userId: data.userId,
			});
		});

		// Disconnect
		socket.on("disconnect", () => {
			console.log(`❌ User disconnected: ${data.username}`);
		});
	});
}
