import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

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

				const workosId = `workos_${email.split("@")[0]}`;

				return {
					user: {
						id: workosId,
						email,
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
				if (refreshToken === "invalid_token") {
					throw new Error("Invalid refresh token");
				}

				return {
					accessToken: "new_access_token",
					refreshToken: "new_refresh_token",
				};
			},
			// ⭐ SIMPLIFICADO: getUser acepta cualquier token que empiece con "user_test_"
			getUser: async (token: string) => {
				if (token === "invalid-token") {
					throw new Error("Invalid token");
				}

				// ⭐ El token ES el workos_id directamente
				if (!token || !token.startsWith("user_test_")) {
					return null;
				}

				return {
					id: token, // ⭐ Retorna el token como id (que es el workos_id)
					email: `test-${token}@example.com`,
					firstName: "Test",
					lastName: "User",
				};
			},
		},
	} as any;

	fastify.decorate("workos", mockWorkos);
};

export default fp(mockWorkosPlugin);
