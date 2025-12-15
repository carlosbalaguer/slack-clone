import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { WorkOSClient } from "../../utils/workos-client.js";

const mockWorkosPlugin: FastifyPluginAsync = async (fastify) => {
	const mockWorkos = {
		userManagement: {
			createMagicAuth: async ({ email }: { email: string }) => ({
				id: "magic_123",
				email,
			}),
			authenticateWithMagicAuth: async ({
				email,
				code,
			}: {
				email: string;
				code: string;
			}) => {
				if (
					code === "invalid" ||
					code === "wrong" ||
					code === "wrong2"
				) {
					throw new Error("Invalid code");
				}

				// Generamos un ID consistente basado en el email si es posible, o random
				const workosId = email
					? `workos_${email.split("@")[0]}`
					: "workos_mock_user";

				return {
					user: {
						id: workosId,
						email: email || "mock@example.com",
						firstName: "Test",
						lastName: "User",
					},
					accessToken: "mock_access_token",
					refreshToken: "mock_refresh_token",
				};
			},
			authenticateWithRefreshToken: async ({
				refreshToken,
			}: {
				refreshToken: string;
			}) => {
				if (refreshToken === "invalid_token")
					throw new Error("Invalid refresh token");
				return {
					accessToken: "new_access_token",
					refreshToken: "new_refresh_token",
				};
			},
			getUser: async (token: string) => {
				if (token === "invalid-token") throw new Error("Invalid token");
				if (!token || !token.startsWith("user_test_")) return null;
				return {
					id: token,
					email: `test-${token}@example.com`,
					firstName: "Test",
					lastName: "User",
				};
			},
		},
	} as any;

	const mockWorkosClient = {
		async sendMagicLink(email: string) {
			return await mockWorkos.userManagement.createMagicAuth({ email });
		},

		async authenticateWithCode(code: string) {
			// En el mock, asumimos un email por defecto o lo extraemos si el code fuera especial.
			// Para simplificar tests, usamos un email fijo ya que el code valida el éxito.
			const mockEmail = "mock@example.com";

			const result =
				await mockWorkos.userManagement.authenticateWithMagicAuth({
					email: mockEmail,
					code,
				});

			return {
				user: result.user,
				accessToken: result.accessToken,
				refreshToken: result.refreshToken,
			};
		},

		async getUser(userId: string) {
			return await mockWorkos.userManagement.getUser(userId);
		},

		// Métodos de métricas y salud (necesarios porque existen en la clase real)
		healthCheck() {
			return {
				magicLink: { state: "closed", healthy: true },
				authenticate: { state: "closed", healthy: true },
				getUser: { state: "closed", healthy: true },
			};
		},
		getStats() {
			return {
				magicLink: {
					failures: 0,
					successes: 100,
					rejects: 0,
					timeouts: 0,
				},
				authenticate: {
					failures: 0,
					successes: 100,
					rejects: 0,
					timeouts: 0,
				},
				getUser: {
					failures: 0,
					successes: 100,
					rejects: 0,
					timeouts: 0,
				},
			};
		},
	};

	fastify.decorate("workos", mockWorkos);
	fastify.decorate(
		"workosClient",
		mockWorkosClient as unknown as WorkOSClient
	);
};

export default fp(mockWorkosPlugin);
