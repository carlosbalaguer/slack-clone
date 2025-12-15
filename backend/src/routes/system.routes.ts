import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { FastifyInstance } from "fastify";
import { metrics } from "../observability/index.js";

/**
 * System routes (health, metrics, etc.)
 * These routes are NOT versioned
 */
export async function systemRoutes(fastify: FastifyInstance) {
	/**
	 * GET /health
	 * Health check endpoint for load balancers and monitoring
	 */
	fastify.get("/health", async (request, reply) => {
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

				const { data, error } = await fastify.supabase
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
				await fastify.redis.ping();

				redisSpan.setAttribute("redis.status", "healthy");
				redisSpan.setStatus({ code: SpanStatusCode.OK });
				checks.redis = "ok";
			} catch (error) {
				redisSpan.setAttribute("redis.status", "unhealthy");
				redisSpan.recordException(error as Error);
				redisSpan.setStatus({ code: SpanStatusCode.ERROR });
				checks.redis = "error";

				request.log.error(
					{ err: error },
					"Redis health check failed"
				);
			} finally {
				redisSpan.end();
			}

			// ============================================
			// QUEUE CHECK
			// ============================================
			const queueSpan = tracer.startSpan("health.queue-check");
			try {
				span.addEvent("checking-queue");
				const notificationQueue = fastify.queues.notifications;
				const jobCounts = await notificationQueue.getJobCounts();

				queueSpan.setAttribute("queue.status", "healthy");
				queueSpan.setAttribute(
					"queue.waiting",
					jobCounts.waiting || 0
				);
				queueSpan.setAttribute("queue.active", jobCounts.active || 0);
				queueSpan.setAttribute("queue.failed", jobCounts.failed || 0);
				queueSpan.setStatus({ code: SpanStatusCode.OK });
				checks.queue = "ok";
			} catch (error) {
				queueSpan.setAttribute("queue.status", "unhealthy");
				queueSpan.recordException(error as Error);
				queueSpan.setStatus({ code: SpanStatusCode.ERROR });
				checks.queue = "error";

				request.log.error(
					{ err: error },
					"Queue health check failed"
				);
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

				// Verificar si workosClient existe (puede no existir en tests)
				if (fastify.workosClient) {
					const circuitBreakers = fastify.workosClient.healthCheck();

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
					checks.circuitBreakers = allCircuitsHealthy
						? "ok"
						: "degraded";
				} else {
					// En tests con mockWorkos, skip circuit breaker check
					circuitSpan.setAttribute("circuits.status", "skipped");
					circuitSpan.setStatus({ code: SpanStatusCode.OK });
					checks.circuitBreakers = "ok";
				}
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
				"check.circuitBreakers": checks.circuitBreakers || "unknown",
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
						.filter(([_, status]) => status !== "ok")
						.map(([name]) => name)
						.join(", ")
				);
				span.setStatus({ code: SpanStatusCode.ERROR });
			}

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

			return {
				status: "error",
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
			};
		} finally {
			span.end();
		}
	});

	/**
	 * GET /metrics
	 * Prometheus metrics endpoint
	 */
	fastify.get("/metrics", async (request, reply) => {
		reply.header("Content-Type", metrics.register.contentType);
		return metrics.register.metrics();
	});

	fastify.log.info("✅ System routes registered (health, metrics)");
}