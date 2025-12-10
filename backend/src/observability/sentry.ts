import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import "dotenv/config";

export function initSentry() {
	if (!process.env.SENTRY_DSN) {
		console.log("⏭️  Sentry disabled (no DSN configured)");
		return null;
	}

	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		environment: process.env.NODE_ENV || "development",

		// Performance Monitoring
		tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0, // 10% en prod

		// Profiling
		profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
		integrations: [nodeProfilingIntegration()],
		// Release tracking
		release: process.env.SERVICE_VERSION || "1.0.0",

		// Filtros
		ignoreErrors: [
			// Errores comunes que no son bugs
			"ECONNRESET",
			"ENOTFOUND",
			"ETIMEDOUT",
		],

		beforeSend(event, hint) {
			// No enviar errores de rate limiting
			if (event.exception?.values?.[0]?.value?.includes("rate limit")) {
				return null;
			}
			return event;
		},
	});

	console.log("🐛 Sentry error tracking initialized");
	return Sentry;
}
