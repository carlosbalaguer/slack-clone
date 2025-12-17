import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

/**
 * Rate limiting plugin with Redis storage
 * Protects against DDoS, brute force, and API abuse
 */
export const rateLimitPlugin = fp(async (fastify: FastifyInstance) => {
	// ============================================
	// GLOBAL RATE LIMIT CONFIGURATION
	// ============================================
	await fastify.register(rateLimit, {
		global: true,

		// ============================================
		// REDIS STORAGE (distributed rate limiting)
		// ============================================
		redis: fastify.redis, // Use existing Redis connection

		// ============================================
		// DEFAULT LIMITS
		// ============================================
		max: 100, // Maximum requests
		timeWindow: "1 minute", // Time window

		// ============================================
		// CACHE SETTINGS
		// ============================================
		cache: 10000, // Cache 10k keys in memory (performance)

		// ============================================
		// SKIP CERTAIN ROUTES
		// ============================================
		skipOnError: false, // Don't skip on Redis errors (fail closed)

		// ============================================
		// CUSTOM KEY GENERATOR (IP + User ID)
		// ============================================
		keyGenerator: (request) => {
			const user = request.user as { id: string } | undefined;

			if (user?.id) {
				return `user:${user.id}`;
			}

			const ip =
				request.headers["x-forwarded-for"] ||
				request.headers["x-real-ip"] ||
				request.ip;

			return `ip:${ip}`;
		},
		// ============================================
		// ERROR HANDLER
		// ============================================
		errorResponseBuilder: (request, context) => {
			return {
				statusCode: 429,
				error: "Too Many Requests",
				message: `Rate limit exceeded. Try again in ${Math.ceil(
					context.ttl / 1000
				)} seconds.`,
				retryAfter: context.ttl, // Milliseconds until reset
				limit: context.max,
				remaining: 0,
				reset: new Date(Date.now() + context.ttl).toISOString(),
			};
		},

		// ============================================
		// RATE LIMIT HEADERS (inform clients)
		// ============================================
		addHeaders: {
			"x-ratelimit-limit": true, // Max requests allowed
			"x-ratelimit-remaining": true, // Requests remaining
			"x-ratelimit-reset": true, // When limit resets (Unix timestamp)
			"retry-after": true, // Seconds until retry
		},

		// ============================================
		// ENABLE ON ROUTES
		// ============================================
		enableDraftSpec: true, // Use IETF draft spec headers

		// ============================================
		// CONTINOUS TRACKING (count even after limit)
		// ============================================
		continueExceeding: true, // Track requests even after limit exceeded
	});

	fastify.log.info(
		{
			storage: "redis",
			defaultMax: 100,
			defaultWindow: "1 minute",
			keyStrategy: "ip + user_id",
		},
		"✅ Rate limiting configured"
	);
});
