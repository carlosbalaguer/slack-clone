import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { SecurityConfig } from "../config/index.js";

/**
 * Additional security headers not covered by Helmet
 */
async function securityHeadersPlugin(fastify: FastifyInstance) {
	fastify.addHook("onSend", async (request, reply) => {
		// ============================================
		// Permissions-Policy (Feature-Policy)
		// ============================================
		reply.header(
			"Permissions-Policy",
			SecurityConfig.PERMISSIONS_POLICY.join(", ")
		);

		// ============================================
		// X-Robots-Tag (evitar indexación de API)
		// ============================================
		const shouldNoIndex = SecurityConfig.NO_INDEX_ROUTES.some((route) =>
			request.url.startsWith(route)
		);

		if (shouldNoIndex) {
			reply.header("X-Robots-Tag", "noindex, nofollow");
		}

		// ============================================
		// Cache-Control para rutas sensibles
		// ============================================
		const shouldNoCache = SecurityConfig.NO_CACHE_ROUTES.some((route) =>
			request.url.includes(route)
		);

		if (shouldNoCache) {
			reply.header(
				"Cache-Control",
				"no-store, no-cache, must-revalidate, private"
			);
			reply.header("Pragma", "no-cache");
			reply.header("Expires", "0");
		}

		// ============================================
		// Server header (ocultar información)
		// ============================================
		reply.removeHeader("Server");
		reply.removeHeader("X-Powered-By");
	});

	fastify.log.info("✅ Additional security headers configured");
}

export default fp(securityHeadersPlugin, {
	name: "security-headers-plugin",
});