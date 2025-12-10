import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

export const mockUser = {
	id: "user_test123",
	email: "test@example.com",
	firstName: "Test",
	lastName: "User",
};

const mockAuthPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
	const mockState = {
		userId: "default_user_id",
	};
	fastify.decorate("setMockUserId", (userId: string) => {
		mockState.userId = userId;
	});

	fastify.decorate("authenticate", async (request: any) => {
		request.user = {
			id: mockState.userId, // ⭐ workos_id
			email: "test@example.com",
			firstName: "Test",
			lastName: "User",
		};
	});

	fastify.log.info("✅ Mock Auth registered");
};

export default fp(mockAuthPlugin, {
	name: "mock-auth",
});
