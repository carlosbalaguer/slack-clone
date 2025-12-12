import CircuitBreaker from "opossum";
import type { FastifyInstance } from "fastify";

/**
 * Opciones de configuración del circuit breaker
 */
export interface CircuitBreakerOptions {
	timeout?: number; // Timeout en ms (default: 3000)
	errorThresholdPercentage?: number; // % de errores para abrir (default: 50)
	resetTimeout?: number; // Tiempo en OPEN antes de HALF_OPEN (default: 30000)
	rollingCountTimeout?: number; // Ventana de tiempo para calcular % (default: 10000)
	rollingCountBuckets?: number; // Buckets en la ventana (default: 10)
	name?: string; // Nombre para logging
}

/**
 * Crea un circuit breaker con opciones por defecto
 */
export function createCircuitBreaker<T extends any[], R>(
	fn: (...args: T) => Promise<R>,
	options: CircuitBreakerOptions = {}
): CircuitBreaker<T, R> {
	const breaker = new CircuitBreaker(fn, {
		timeout: options.timeout || 3000, // 3 segundos
		errorThresholdPercentage: options.errorThresholdPercentage || 50, // 50% de errores
		resetTimeout: options.resetTimeout || 30000, // 30 segundos
		rollingCountTimeout: options.rollingCountTimeout || 10000, // 10 segundos
		rollingCountBuckets: options.rollingCountBuckets || 10,
		name: options.name || "circuit-breaker",
	});

	return breaker;
}

/**
 * Registra eventos del circuit breaker para observability
 */
export function registerCircuitBreakerEvents(
	breaker: CircuitBreaker<any, any>,
	app: FastifyInstance,
	name: string
) {
	breaker.on("open", () => {
		app.log.warn({
			circuit: name,
			event: "open",
			message: `Circuit breaker ${name} opened`,
		});
	});

	breaker.on("halfOpen", () => {
		app.log.info({
			circuit: name,
			event: "halfOpen",
			message: `Circuit breaker ${name} half-open (testing)`,
		});
	});

	breaker.on("close", () => {
		app.log.info({
			circuit: name,
			event: "close",
			message: `Circuit breaker ${name} closed (healthy)`,
		});
	});

	breaker.on("timeout", () => {
		app.log.error({
			circuit: name,
			event: "timeout",
			message: `Circuit breaker ${name} timeout`,
		});
	});

	breaker.on("reject", () => {
		app.log.warn({
			circuit: name,
			event: "reject",
			message: `Circuit breaker ${name} rejected request (circuit open)`,
		});
	});

	breaker.on("success", (result) => {
		app.log.debug({
			circuit: name,
			event: "success",
			message: `Circuit breaker ${name} successful request`,
		});
	});

	breaker.on("failure", (error) => {
		app.log.error({
			circuit: name,
			event: "failure",
			error: error.message,
			message: `Circuit breaker ${name} failed request`,
		});
	});
}

/**
 * Stats del circuit breaker para métricas
 */
export function getCircuitBreakerStats(breaker: CircuitBreaker<any, any>) {
	const stats = breaker.stats;

	return {
		state: breaker.opened ? "open" : breaker.halfOpen ? "half-open" : "closed",
		failures: stats.failures,
		successes: stats.successes,
		rejects: stats.rejects,
		timeouts: stats.timeouts,
		fallbacks: stats.fallbacks,
		latencyMean: stats.latencyMean,
		latencyPercentile95: stats.percentiles[95],
	};
}