import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import "dotenv/config";
import Fastify, { type FastifyError } from "fastify";
import { Server } from "socket.io";

import {
	createRequestLogger,
	logger,
	metrics,
	sentry,
} from "./observability/index.js";

// Plugins
import securityHeadersPlugin from "./config/security-headers.plugin.js";
import { databasePlugin } from "./plugins/database.js";
import helmetPlugin from "./plugins/helmet.plugin.js";
import { redisPlugin } from "./plugins/redis.js";
import { workosAuthPlugin } from "./plugins/workos-auth.js";

// Routes
import { setupRoutes } from "./routes/index.js";

// WebSocket
import { queuePlugin } from "./plugins/queue.js";
import { setupWebSocket } from "./websocket/index.js";
import { startWorkers } from "./workers/index.js";
import { setupScheduledJobs } from "./workers/scheduler.worker.js";

export interface BuildOptions {
	mockAuth?: boolean;
	mockWorkos?: boolean;
	enableWorkers?: boolean;
	enableScheduler?: boolean;
	enableWebSocket?: boolean;
}

export async function build(options?: BuildOptions) {
	const {
		mockAuth = false,
		mockWorkos = false,
		enableWorkers = process.env.NODE_ENV !== "test",
		enableScheduler = process.env.NODE_ENV !== "test",
		enableWebSocket = true,
	} = options || {};

	const app = Fastify({
		loggerInstance: logger,
		requestIdHeader: "x-request-id",
		disableRequestLogging: false,
	});

	if (sentry) {
		const sentryInstance = sentry;

		app.addHook("onRequest", async (request, reply) => {
			sentryInstance.addBreadcrumb({
				message: `${request.method} ${request.url}`,
				category: "http",
				level: "info",
				data: {
					method: request.method,
					url: request.url,
					ip: request.ip,
				},
			});
		});
	} else {
		console.log("⏭️  Sentry not initialized in app.ts");
	}

	app.addHook("onRequest", async (request, reply) => {
		(request as any).log = createRequestLogger(logger, request);
		(request as any).startTime = Date.now();

		request.log.info(
			{
				method: request.method,
				url: request.url,
				ip: request.ip,
			},
			"Incoming request"
		);
	});

	app.addHook("onResponse", async (request, reply) => {
		const duration = (Date.now() - (request as any).startTime) / 1000;
		const route = request.routeOptions?.url || request.url;

		// Registrar métricas HTTP
		metrics.httpRequestDuration.observe(
			{ method: request.method, route, status_code: reply.statusCode },
			duration
		);

		metrics.httpRequestsTotal.inc({
			method: request.method,
			route,
			status_code: reply.statusCode,
		});

		request.log.info(
			{
				method: request.method,
				url: request.url,
				statusCode: reply.statusCode,
				responseTime: duration * 1000,
			},
			"Request completed"
		);
	});

	app.setErrorHandler((error, request, reply) => {
		const err = error as FastifyError;

		const statusCode = err.statusCode || 500;

		request.log.error(
			{
				err: err,
				method: request.method,
				url: request.url,
				statusCode: statusCode,
			},
			"Request error"
		);

		if (sentry && statusCode >= 500) {
			sentry.captureException(err, {
				tags: {
					method: request.method,
					url: request.url,
				},
				user: {
					id: (request as any).user?.id,
					email: (request as any).user?.email,
				},
				extra: {
					body: request.body,
					query: request.query,
					params: request.params,
				},
			});
		}

		const isProduction = process.env.NODE_ENV === "production";

		const message =
			isProduction && statusCode === 500
				? "Internal server error"
				: err.message;

		reply.status(statusCode).send({ error: message });
	});

	await app.register(cors, {
		origin: process.env.FRONTEND_URL || "*",
		credentials: true,
	});

	await app.register(helmetPlugin);
	await app.register(securityHeadersPlugin);

	await app.register(jwt, {
		secret: process.env.JWT_SECRET!,
	});

	await app.register(rateLimit, {
		max: 100,
		timeWindow: "1 minute",
	});

	await app.register(databasePlugin);
	await app.register(redisPlugin);
	await app.register(queuePlugin);

	if (mockWorkos) {
		const mockWorkosPlugin = await import(
			"../tests/integration/plugins/mock-workos.js"
		);
		await app.register(mockWorkosPlugin.default);
	} else {
		await app.register(workosAuthPlugin);
	}

	if (mockAuth) {
		const { default: mockAuthPlugin } = await import(
			"../tests/integration/plugins/mock-auth.js"
		);
		await app.register(mockAuthPlugin);
	}

	if (enableWebSocket) {
		const appAny = app as any;

		if (!appAny.io) {
			const io = new Server(app.server, {
				cors: {
					origin: process.env.FRONTEND_URL || "*",
					credentials: true,
				},
			});

			appAny.io = io;
			setupWebSocket(io, app);
			app.log.info("✅ WebSocket enabled");
		}
	} else {
		app.log.info("⏭️  WebSocket disabled");
	}

	await setupRoutes(app);

	// ⭐ SOLO PARA TESTING - Eliminar después
	if (process.env.NODE_ENV !== "production") {
		console.log("⚠️  Sentry test route enabled");
		app.get("/sentry-test", async (request, reply) => {
			const query = request.query as { type?: string };

			// Test 1: Error simple
			if (query.type === "simple") {
				throw new Error("This is a test error for Sentry");
			}

			// Test 2: Error 500
			if (query.type === "500") {
				const error: any = new Error("Internal server error test");
				error.statusCode = 500;
				throw error;
			}

			// Test 3: Error con contexto
			if (query.type === "context") {
				try {
					JSON.parse("invalid json{");
				} catch (error) {
					if (sentry) {
						sentry.captureException(error, {
							tags: { test: "manual-capture" },
							extra: { info: "This was a manual test" },
						});
					}
					throw error;
				}
			}

			return { status: "ok" };
		});
	}

	if (enableWorkers) {
		const workers = startWorkers(app);
		app.decorate("workers", workers);
		app.log.info("✅ Workers started");
	} else {
		app.log.info("⏭️  Workers disabled");
	}

	if (enableScheduler) {
		setupScheduledJobs(app);
		app.log.info("✅ Scheduled jobs configured");
	} else {
		app.log.info("⏭️  Scheduler disabled");
	}

	return app;
}
