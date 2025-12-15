import type { FastifyInstance } from "fastify";
import { systemRoutes } from "./system.routes.js";
import { v1Routes } from "./v1/index.js";
import { addVersionHeaders } from "./version.middleware.js";

/**
 * Setup all API routes with versioning
 */
export async function setupRoutes(fastify: FastifyInstance) {
		// ============================================
	// System routes (non-versioned)
	// ============================================
	await systemRoutes(fastify);

	// ============================================
	// API v1 - Current version
	// ============================================
	await fastify.register(
		async (instance) => {
			// Añadir headers de versión a todas las respuestas v1
			instance.addHook("onSend", addVersionHeaders("v1"));
			await v1Routes(instance);
		},
		{ prefix: "/api/v1" }
	);

	// ============================================
	// Default redirect: /api/* → /api/v1/*
	// ============================================
	fastify.get("/api/auth/*", async (request, reply) => {
		const path = request.url.replace("/api/", "/api/v1/");
		return reply.redirect(path, 301);
	});

	fastify.get("/api/channels/*", async (request, reply) => {
		const path = request.url.replace("/api/", "/api/v1/");
		return reply.redirect(path, 301);
	});

	fastify.get("/api/messages/*", async (request, reply) => {
		const path = request.url.replace("/api/", "/api/v1/");
		return reply.redirect(path, 301);
	});

	fastify.get("/api/users/*", async (request, reply) => {
		const path = request.url.replace("/api/", "/api/v1/");
		return reply.redirect(path, 301);
	});

	// POST redirects
	fastify.post("/api/auth/*", async (request, reply) => {
		const path = request.url.replace("/api/", "/api/v1/");
		return reply.redirect(path, 307); // 307 preserva method
	});

	fastify.post("/api/channels", async (request, reply) => {
		return reply.redirect("/api/v1/channels", 307);
	});

	fastify.post("/api/messages", async (request, reply) => {
		return reply.redirect("/api/v1/messages", 307);
	});

	// ============================================
	// API Info endpoint
	// ============================================
	fastify.get("/api", async (request, reply) => {
		return {
			name: "Slack Clone API",
			versions: {
				current: "v1",
				available: ["v1"],
				deprecated: [],
			},
			endpoints: {
				v1: "/api/v1",
				health: "/health",
				metrics: "/metrics",
			},
			documentation: "/api/docs", // Para futuro Swagger
		};
	});

	fastify.log.info("✅ API routes configured with versioning");
}