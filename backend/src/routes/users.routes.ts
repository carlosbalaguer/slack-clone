import type { FastifyInstance } from "fastify";
import { userService } from "../services/user.service.js";
import { getAuthUserId } from "../utils/auth.js";

export async function usersRoutes(fastify: FastifyInstance) {
	// Get all users
	fastify.get(
		"/",
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			const { page, limit } = request.query as {
				page?: string;
				limit?: string;
			};

			const result = await userService.list(
				fastify,
				parseInt(page || "1"),
				parseInt(limit || "20")
			);

			return result;
		}
	);

	// Get user by ID
	fastify.get(
		"/:id",
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			const { id } = request.params as { id: string };

			const user = await userService.findById(fastify, id);

			if (!user) {
				return reply.status(404).send({ error: "User not found" });
			}

			return { user };
		}
	);

	// Update current user status
	fastify.patch(
		"/me/status",
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			try {
				const workosUserId = getAuthUserId(request);
				const { status } = request.body as { status: string };

				const validStatuses = ["online", "away", "busy", "offline"];
				if (!validStatuses.includes(status)) {
					return reply.status(400).send({ error: "Invalid status" });
				}

				const user = await userService.update(fastify, {
					workosId: workosUserId,
					status,
				});
				return { user };
			} catch (err) {
				fastify.log.error(err);
				return reply
					.status(400)
					.send({ error: "Failed to update status" });
			}
		}
	);

	// Update current user profile
	fastify.patch(
		"/me",
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			try {
				const workosUserId = getAuthUserId(request);
				const { display_name, avatar_url } = request.body as any;

				const user = await userService.update(fastify, {
					workosId: workosUserId,
					display_name: display_name,
					avatar_url: avatar_url,
				});

				return { user };
			} catch (err) {
				fastify.log.error(err);
				console.log("Error update profile: ", err);
				return reply
					.status(400)
					.send({ error: "Failed to update profile" });
			}
		}
	);
}
