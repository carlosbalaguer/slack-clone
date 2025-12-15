/**
 * Security configuration constants
 *
 * Centralized security settings for the application.
 * All security-related configurations should be defined here.
 */
export const SecurityConfig = {
	/**
	 * HSTS (HTTP Strict Transport Security)
	 * Forces HTTPS connections and prevents downgrade attacks
	 */
	HSTS: {
		MAX_AGE: 31536000, // 1 year in seconds
		INCLUDE_SUBDOMAINS: true,
		PRELOAD: true,
	},

	/**
	 * Permissions Policy - Browser features to disable
	 * Controls which browser features and APIs can be used
	 */
	PERMISSIONS_POLICY: [
		"geolocation=()",
		"microphone=()",
		"camera=()",
		"payment=()",
		"usb=()",
		"magnetometer=()",
		"gyroscope=()",
		"accelerometer=()",
	],

	/**
	 * Routes that should never be cached
	 * Prevents sensitive data from being stored in browser cache
	 */
	NO_CACHE_ROUTES: ["/auth/", "/me"],

	/**
	 * Routes that should not be indexed by search engines
	 * Protects API endpoints from being indexed
	 */
	NO_INDEX_ROUTES: ["/api/"],

	/**
	 * External services allowed for API connections
	 * Whitelist of trusted external domains used by backend services
	 */
	ALLOWED_CONNECT_SOURCES: [
		// Supabase (Database)
		"https://*.supabase.co",

		// Upstash (Redis)
		"https://*.upstash.io",

		// WorkOS (Authentication)
		"https://api.workos.com",
		"https://*.workos.com",

		// Sentry (Error tracking)
		"https://*.sentry.io",
		"https://sentry.io",
	],

	/**
	 * Development-only allowed sources
	 * Additional sources allowed only in development environment
	 */
	DEV_ALLOWED_SOURCES: [
		// Frontend development server
		"http://localhost:5173",
		"ws://localhost:5173",
		"http://localhost:3000",

		// OpenTelemetry/Jaeger (local)
		"http://localhost:4318",
		"http://localhost:16686",

		// Prometheus (local)
		"http://localhost:9090",

		// Grafana (local)
		"http://localhost:3001",
	],
} as const;
