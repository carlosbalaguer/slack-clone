import { WorkOS } from "@workos-inc/node";
import type { FastifyInstance } from "fastify";
import type CircuitBreaker from "opossum";
import {
	createCircuitBreaker,
	registerCircuitBreakerEvents,
} from "./circuit-breaker.js";

/**
 * Cliente de WorkOS con circuit breakers
 */
export class WorkOSClient {
	private workos: WorkOS;
	private sendMagicLinkBreaker: CircuitBreaker<
		[{ email: string }],
		{ id: string }
	>;
	private authenticateBreaker: CircuitBreaker<
		[{ code: string; email: string }],
		any
	>;
	private getUserBreaker: CircuitBreaker<[string], any>;
	private refreshTokenBreaker: CircuitBreaker<[string], any>;

	constructor(private app: FastifyInstance) {
		this.workos = new WorkOS(process.env.WORKOS_API_KEY);

		// Circuit breaker para magic link
		this.sendMagicLinkBreaker = createCircuitBreaker(
			async (params: { email: string }) => {
				return await this.workos.userManagement.createMagicAuth({
					email: params.email,
				});
			},
			{
				name: "workos-magic-link",
				timeout: 5000, // 5 segundos
				errorThresholdPercentage: 60,
				resetTimeout: 30000,
			}
		);

		// Circuit breaker para autenticación
		this.authenticateBreaker = createCircuitBreaker(
			async (params: { code: string; email: string }) => {
				return await this.workos.userManagement.authenticateWithMagicAuth(
					{
						email: params.email,
						code: params.code,
						clientId: process.env.WORKOS_CLIENT_ID!,
					}
				);
			},
			{
				name: "workos-authenticate",
				timeout: 5000,
				errorThresholdPercentage: 60,
				resetTimeout: 30000,
			}
		);

		// Circuit breaker para obtener usuario
		this.getUserBreaker = createCircuitBreaker(
			async (userId: string) => {
				return await this.workos.userManagement.getUser(userId);
			},
			{
				name: "workos-get-user",
				timeout: 3000,
				errorThresholdPercentage: 50,
				resetTimeout: 20000,
			}
		);

		this.refreshTokenBreaker = createCircuitBreaker(
			async (refreshToken: string) => {
				return await this.workos.userManagement.authenticateWithRefreshToken(
					{
						refreshToken,
						clientId: process.env.WORKOS_CLIENT_ID!,
					}
				);
			},
			{
				name: "workos-refresh-token",
				timeout: 3000,
				errorThresholdPercentage: 50,
				resetTimeout: 20000,
			}
		);

		// Registrar eventos para observability
		registerCircuitBreakerEvents(
			this.sendMagicLinkBreaker,
			app,
			"workos-magic-link"
		);
		registerCircuitBreakerEvents(
			this.authenticateBreaker,
			app,
			"workos-authenticate"
		);
		registerCircuitBreakerEvents(
			this.getUserBreaker,
			app,
			"workos-get-user"
		);
		registerCircuitBreakerEvents(
			this.refreshTokenBreaker,
			app,
			"workos-refresh-token"
		);

		// Fallback strategies
		this.sendMagicLinkBreaker.fallback(() => {
			throw new Error("Authentication service temporarily unavailable");
		});

		this.authenticateBreaker.fallback(() => {
			throw new Error("Authentication service temporarily unavailable");
		});

		this.getUserBreaker.fallback(() => {
			throw new Error("User service temporarily unavailable");
		});

		this.refreshTokenBreaker.fallback(() => {
			throw new Error("Authentication service temporarily unavailable");
		});
	}

	/**
	 * Enviar magic link (protegido por circuit breaker)
	 */
	async sendMagicLink(email: string) {
		return await this.sendMagicLinkBreaker.fire({ email });
	}

	/**
	 * Autenticar con código (protegido por circuit breaker)
	 */
	async authenticateWithCode(code: string, email: string) {
		return await this.authenticateBreaker.fire({ code, email });
	}

	/**
	 * Obtener usuario (protegido por circuit breaker)
	 */
	async getUser(userId: string) {
		return await this.getUserBreaker.fire(userId);
	}

	async refreshToken(refreshToken: string) {
		return await this.refreshTokenBreaker.fire(refreshToken);
	}

	/**
	 * Stats de todos los circuit breakers (para métricas)
	 */
	getStats() {
		return {
			magicLink: this.sendMagicLinkBreaker.stats,
			authenticate: this.authenticateBreaker.stats,
			getUser: this.getUserBreaker.stats,
		};
	}

	/**
	 * Health check de los circuit breakers
	 */
	healthCheck() {
		return {
			magicLink: {
				state: this.sendMagicLinkBreaker.opened
					? "open"
					: this.sendMagicLinkBreaker.halfOpen
					? "half-open"
					: "closed",
				healthy: !this.sendMagicLinkBreaker.opened,
			},
			authenticate: {
				state: this.authenticateBreaker.opened
					? "open"
					: this.authenticateBreaker.halfOpen
					? "half-open"
					: "closed",
				healthy: !this.authenticateBreaker.opened,
			},
			getUser: {
				state: this.getUserBreaker.opened
					? "open"
					: this.getUserBreaker.halfOpen
					? "half-open"
					: "closed",
				healthy: !this.getUserBreaker.opened,
			},
		};
	}
}
