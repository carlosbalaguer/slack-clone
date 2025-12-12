import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import {
	magicLinkSchema,
	refreshTokenSchema,
	verifyMagicLinkSchema,
} from "../schemas/auth.schema.js";
import { userService } from "../services/user.service.js";
import { getAuthUserId } from "../utils/auth.js";

export async function authRoutes(fastify: FastifyInstance) {
	// Send magic link
	fastify.post("/magic-link", async (request, reply) => {
		try {
			const { email } = magicLinkSchema.parse(request.body);

			await fastify.workosClient.sendMagicLink(email);

			return { message: "Magic link sent to your email" };
		} catch (err: any) {
			if (
				err.message === "Authentication service temporarily unavailable"
			) {
				return reply.status(503).send({
					error: "Authentication service temporarily unavailable. Please try again later.",
				});
			}

			fastify.log.error(err);
			return reply
				.status(400)
				.send({ error: "Failed to send magic link" });
		}
	});

	// Verify magic link code
	fastify.post("/verify", async (request, reply) => {
		try {
			const { email, code } = verifyMagicLinkSchema.parse(request.body);

			const {
				user: workosUser,
				accessToken,
				refreshToken,
			} = await fastify.workosClient.authenticateWithCode(code, email);

			const dbUser = await userService.findOrCreate(fastify, {
				workosId: workosUser.id,
				email: workosUser.email,
				firstName: workosUser.firstName || undefined,
				lastName: workosUser.lastName || undefined,
				profilePictureUrl: workosUser.profilePictureUrl || undefined,
			});

			return {
				user: dbUser,
				accessToken,
				refreshToken,
			};
		} catch (err: any) {
			if (
				err.message === "Authentication service temporarily unavailable"
			) {
				return reply.status(503).send({
					error: "Authentication service temporarily unavailable. Please try again later.",
				});
			}

			if (err instanceof ZodError) {
				fastify.log.error(err);
				return reply.status(400).send({
					error: "Validation error",
					details: err.message,
				});
			}

			fastify.log.error(err);
			return reply.status(401).send({ error: "Invalid code" });
		}
	});

	fastify.post("/refresh", async (request, reply) => {
		try {
			const { refreshToken } = refreshTokenSchema.parse(request.body);

			const response = await fastify.workosClient.refreshToken(
				refreshToken
			);

			return {
				accessToken: response.accessToken,
				refreshToken: response.refreshToken,
			};
		} catch (err) {
			if (err instanceof ZodError) {
				fastify.log.error(err);
				return reply.status(400).send({
					error: "Validation error",
					details: err.message,
				});
			}

			fastify.log.error("Refresh token failed:", undefined, err);
			return reply.status(401).send({ error: "Invalid refresh token" });
		}
	});

	// Get current user
	fastify.get(
		"/me",
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			const userId = getAuthUserId(request);
			const user = await userService.findByWorkosId(fastify, userId);

			if (!user)
				return reply.status(404).send({ error: "User not found" });
			return { user };
		}
	);
}
