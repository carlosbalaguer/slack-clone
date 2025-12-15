import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.routes.js";
import { channelsRoutes } from "./channels.routes.js";
import { messagesRoutes } from "./messages.routes.js";
import { usersRoutes } from "./users.routes.js";

/**
 * Register all v1 routes
 */
export async function v1Routes(fastify: FastifyInstance) {
	// Auth routes
	await fastify.register(authRoutes, { prefix: "/auth" });

	// Channels routes
	await fastify.register(channelsRoutes, { prefix: "/channels" });

	// Messages routes
	await fastify.register(messagesRoutes, { prefix: "/messages" });

	// Users routes
	await fastify.register(usersRoutes, { prefix: "/users" });

	fastify.log.info("✅ API v1 routes registered");
}