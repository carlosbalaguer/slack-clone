import type { FastifyHelmetOptions } from "@fastify/helmet";
import { SecurityConfig } from "./security.config.js";

export function getHelmetConfig(): FastifyHelmetOptions {
	const isProduction = process.env.NODE_ENV === "production";
	const isDevelopment = process.env.NODE_ENV === "development";

	return {
		// ============================================
		// Content Security Policy (CSP)
		// ============================================
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				imgSrc: ["'self'", "data:", "https:"],
				connectSrc: [
					"'self'",
					...SecurityConfig.ALLOWED_CONNECT_SOURCES,
					...(isDevelopment
						? SecurityConfig.DEV_ALLOWED_SOURCES
						: []),
				],
				fontSrc: ["'self'", "data:"],
				objectSrc: ["'none'"],
				mediaSrc: ["'self'"],
				frameSrc: ["'none'"],
			},
		},

		// ============================================
		// Cross-Origin Policies
		// ============================================
		crossOriginEmbedderPolicy: !isDevelopment,
		crossOriginOpenerPolicy: { policy: "same-origin" },
		crossOriginResourcePolicy: { policy: "cross-origin" },

		// ============================================
		// DNS Prefetch Control
		// ============================================
		dnsPrefetchControl: { allow: false },

		// ============================================
		// Frameguard (Clickjacking protection)
		// ============================================
		frameguard: { action: "deny" },

		// ============================================
		// Hide Powered-By
		// ============================================
		hidePoweredBy: true,

		// ============================================
		// HSTS (HTTP Strict Transport Security)
		// ============================================
		hsts: isProduction
			? {
					maxAge: SecurityConfig.HSTS.MAX_AGE,
					includeSubDomains: SecurityConfig.HSTS.INCLUDE_SUBDOMAINS,
					preload: SecurityConfig.HSTS.PRELOAD,
			  }
			: false,

		// ============================================
		// IE No Open (legacy)
		// ============================================
		ieNoOpen: true,

		// ============================================
		// No Sniff (MIME type sniffing)
		// ============================================
		noSniff: true,

		// ============================================
		// Origin Agent Cluster
		// ============================================
		originAgentCluster: true,

		// ============================================
		// Permitted Cross-Domain Policies
		// ============================================
		permittedCrossDomainPolicies: { permittedPolicies: "none" },

		// ============================================
		// Referrer Policy
		// ============================================
		referrerPolicy: { policy: "strict-origin-when-cross-origin" },
	};
}
