import type { FastifyInstance } from "fastify";
import {
	magicLinkSchema,
	refreshTokenSchema,
	verifyMagicLinkSchema,
} from "../schemas/auth.schema.js";
import { getAuthUserId } from "../utils/auth.js";
import { ZodError } from "zod";

export async function authRoutes(fastify: FastifyInstance) {
	// Send magic link
	fastify.post("/magic-link", async (request, reply) => {
		try {
			const { email } = magicLinkSchema.parse(request.body);

			await fastify.workos.userManagement.createMagicAuth({
				email,
			});

			return { message: "Magic link sent to your email" };
		} catch (err) {
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
			console.log("Verifying magic link for:", email, "with code:", code);

			const { user, accessToken, refreshToken } =
				await fastify.workos.userManagement.authenticateWithMagicAuth({
					email,
					code,
					clientId: process.env.WORKOS_CLIENT_ID!,
				});

			// Find or create user in DB
			let dbUser = await fastify.supabase
				.from("users")
				.select("*")
				.eq("workos_id", user.id)
				.single();

			if (!dbUser.data) {
				const { data: newUser } = await fastify.supabase
					.from("users")
					.insert({
						workos_id: user.id,
						email: user.email,
						username: user.email.split("@")[0],
						display_name:
							`${user.firstName || ""} ${
								user.lastName || ""
							}`.trim() || user.email.split("@")[0],
						avatar_url: user.profilePictureUrl,
					})
					.select()
					.single();

				dbUser.data = newUser;
			}

			return {
				user: dbUser.data,
				accessToken,
				refreshToken,
			};
		} catch (err) {
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

			// Authenticate with refresh token
			const response =
				await fastify.workos.userManagement.authenticateWithRefreshToken(
					{
						refreshToken,
						clientId: process.env.WORKOS_CLIENT_ID!,
					}
				);

			// WorkOS retorna nuevos tokens
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
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const userId = getAuthUserId(request);

				const { data: user } = await fastify.supabase
					.from("users")
					.select("*")
					.eq("workos_id", userId)
					.single();

				if (!user) {
					return reply.status(404).send({ error: "User not found" });
				}

				return { user };
			} catch (err) {
				return reply.status(401).send({ error: "Unauthorized" });
			}
		}
	);
}
