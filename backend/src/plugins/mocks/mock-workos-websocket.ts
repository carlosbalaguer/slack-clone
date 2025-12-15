import type { FastifyInstance } from "fastify";
import { Socket as ClientSocket, io as ioClient } from "socket.io-client";

export async function createTestWebSocketClient(
	app: FastifyInstance,
	userId: string // Este es el UUID del usuario en DB
): Promise<ClientSocket> {
	const address = await app.server.address();

	if (!address || typeof address !== "object") {
		throw new Error("Server not listening");
	}

	const port = address.port;

	// ⭐ Obtener el workos_id del usuario desde la DB
	const { data: user } = await app.supabase
		.from("users")
		.select("workos_id")
		.eq("id", userId)
		.single();

	if (!user) {
		throw new Error(`User ${userId} not found`);
	}

	// ⭐ Usar el workos_id como token
	const token = user.workos_id;

	console.log(
		`Creating WebSocket client for userId: ${userId} with token: ${token}`
	);

	const client = ioClient(`http://localhost:${port}`, {
		auth: { token },
		transports: ["websocket"],
		forceNew: true,
	});

	return new Promise((resolve, reject) => {
		client.on("connect", () => {
			console.log("Client connected successfully");
			resolve(client);
		});

		client.on("connect_error", (err) => {
			console.error("Connection error:", err.message);
			reject(err);
		});

		// Timeout fallback
		setTimeout(() => reject(new Error("Connection timeout")), 5000);
	});
}

export function waitForEvent(
	socket: ClientSocket,
	event: string,
	timeout: number = 5000
): Promise<any> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`Timeout waiting for event: ${event}`));
		}, timeout);

		socket.once(event, (data) => {
			clearTimeout(timer);
			resolve(data);
		});
	});
}

export async function disconnectClient(socket: ClientSocket): Promise<void> {
	return new Promise((resolve) => {
		if (!socket.connected) {
			resolve();
			return;
		}
		socket.on("disconnect", () => resolve());
		socket.disconnect();
	});
}
