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
import { databasePlugin } from "./plugins/database.js";
import { redisPlugin } from "./plugins/redis.js";
import { workosAuthPlugin } from "./plugins/workos-auth.js";

// Routes
import { authRoutes } from "./routes/auth.routes.js";
import { channelsRoutes } from "./routes/channels.routes.js";
import { messagesRoutes } from "./routes/messages.routes.js";
import { usersRoutes } from "./routes/users.routes.js";

// WebSocket
import { SpanStatusCode, trace } from "@opentelemetry/api";
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

	app.get("/metrics", async (request, reply) => {
		reply.header("Content-Type", metrics.register.contentType);
		return metrics.register.metrics();
	});

	await app.register(authRoutes, { prefix: "/api/auth" });
	await app.register(channelsRoutes, { prefix: "/api/channels" });
	await app.register(messagesRoutes, { prefix: "/api/messages" });
	await app.register(usersRoutes, { prefix: "/api/users" });

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

	app.get("/health", async (request, reply) => {
		const tracer = trace.getTracer("slack-clone-backend");
		const span = tracer.startSpan("health-check");

		const checks: Record<string, string> = {};

		try {
			// ============================================
			// SUPABASE DATABASE CHECK
			// ============================================
			const dbSpan = tracer.startSpan("health.supabase-check");
			try {
				span.addEvent("checking-supabase");

				// Query simple para verificar conectividad
				const { data, error } = await app.supabase
					.from("users")
					.select("id")
					.limit(1);

				if (error) throw error;

				dbSpan.setAttribute("supabase.status", "healthy");
				dbSpan.setAttribute("db.type", "postgresql");
				dbSpan.setAttribute("supabase.provider", "supabase");
				dbSpan.setStatus({ code: SpanStatusCode.OK });
				checks.database = "ok";
			} catch (error) {
				dbSpan.setAttribute("supabase.status", "unhealthy");
				dbSpan.recordException(error as Error);
				dbSpan.setStatus({ code: SpanStatusCode.ERROR });
				checks.database = "error";

				request.log.error(
					{ err: error },
					"Supabase health check failed"
				);
			} finally {
				dbSpan.end();
			}

			// ============================================
			// REDIS CHECK
			// ============================================
			const redisSpan = tracer.startSpan("health.redis-check");
			try {
				span.addEvent("checking-redis");
				await app.redis.ping();

				redisSpan.setAttribute("redis.status", "healthy");
				redisSpan.setStatus({ code: SpanStatusCode.OK });
				checks.redis = "ok";
			} catch (error) {
				redisSpan.setAttribute("redis.status", "unhealthy");
				redisSpan.recordException(error as Error);
				redisSpan.setStatus({ code: SpanStatusCode.ERROR });
				checks.redis = "error";

				request.log.error({ err: error }, "Redis health check failed");
			} finally {
				redisSpan.end();
			}

			// ============================================
			// QUEUE CHECK (opcional)
			// ============================================
			const queueSpan = tracer.startSpan("health.queue-check");
			try {
				span.addEvent("checking-queue");
				// Verifica que Bull queue esté responsive
				const notificationQueue = app.queues.notifications;
				const jobCounts = await notificationQueue.getJobCounts();

				queueSpan.setAttribute("queue.status", "healthy");
				queueSpan.setAttribute("queue.waiting", jobCounts.waiting || 0);
				queueSpan.setAttribute("queue.active", jobCounts.active || 0);
				queueSpan.setAttribute("queue.failed", jobCounts.failed || 0);
				queueSpan.setStatus({ code: SpanStatusCode.OK });
				checks.queue = "ok";
			} catch (error) {
				queueSpan.setAttribute("queue.status", "unhealthy");
				queueSpan.recordException(error as Error);
				queueSpan.setStatus({ code: SpanStatusCode.ERROR });
				checks.queue = "error";

				request.log.error({ err: error }, "Queue health check failed");
			} finally {
				queueSpan.end();
			}

			// ============================================
			// CIRCUIT BREAKERS CHECK
			// ============================================
			const circuitSpan = tracer.startSpan(
				"health.circuit-breakers-check"
			);
			try {
				span.addEvent("checking-circuit-breakers");
				const circuitBreakers = app.workosClient.healthCheck();

				const allCircuitsHealthy =
					circuitBreakers.magicLink.healthy &&
					circuitBreakers.authenticate.healthy &&
					circuitBreakers.getUser.healthy;

				circuitSpan.setAttribute(
					"circuits.status",
					allCircuitsHealthy ? "healthy" : "degraded"
				);
				circuitSpan.setAttribute(
					"circuits.magicLink",
					circuitBreakers.magicLink.state
				);
				circuitSpan.setAttribute(
					"circuits.authenticate",
					circuitBreakers.authenticate.state
				);
				circuitSpan.setAttribute(
					"circuits.getUser",
					circuitBreakers.getUser.state
				);
				circuitSpan.setStatus({ code: SpanStatusCode.OK });
				checks.circuitBreakers = allCircuitsHealthy ? "ok" : "degraded";
			} catch (error) {
				circuitSpan.setAttribute("circuits.status", "error");
				circuitSpan.recordException(error as Error);
				circuitSpan.setStatus({ code: SpanStatusCode.ERROR });
				checks.circuitBreakers = "error";

				request.log.error(
					{ err: error },
					"Circuit breakers health check failed"
				);
			} finally {
				circuitSpan.end();
			}

			// ============================================
			// FINAL STATUS
			// ============================================
			span.addEvent("health-checks-completed", {
				"check.database": checks.database || "unknown",
				"check.redis": checks.redis || "unknown",
				"check.queue": checks.queue || "unknown",
			});

			const allHealthy = Object.values(checks).every(
				(status) => status === "ok"
			);

			if (allHealthy) {
				span.setAttribute("health.status", "healthy");
				span.setStatus({ code: SpanStatusCode.OK });
			} else {
				span.setAttribute("health.status", "degraded");
				span.setAttribute(
					"health.failed_checks",
					Object.entries(checks)
						.filter(([_, status]) => status === "error")
						.map(([name]) => name)
						.join(", ")
				);
				span.setStatus({ code: SpanStatusCode.ERROR });
			}

			// Log estructurado
			request.log.info(
				{
					action: "health.check.completed",
					checks,
					allHealthy,
				},
				"Health check completed"
			);

			return {
				status: allHealthy ? "ok" : "degraded",
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
				checks,
			};
		} catch (error) {
			span.recordException(error as Error);
			span.setStatus({ code: SpanStatusCode.ERROR });

			request.log.error({ err: error }, "Health check failed");

			// Respuesta igual incluso si hay error
			return {
				status: "ok",
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
			};
		} finally {
			span.end();
		}
	});

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
