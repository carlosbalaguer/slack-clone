import type { FastifyInstance } from "fastify";
import { userService } from "../../services/user.service.js";
import type { UserDTO, UserListDTO } from "../../types/dtos/user.dto.js";
import type {
	ListUsersQuery,
	UpdateUserRequest,
} from "../../types/requests/user.request.js";
import type { ErrorResponse } from "../../types/responses/error.response.js";
import { getAuthUserId } from "../../utils/auth.js";

export async function usersRoutes(fastify: FastifyInstance) {
	/**
	 * List all users with pagination
	 */
	fastify.get<{
		Querystring: ListUsersQuery;
		Reply: UserListDTO | ErrorResponse;
	}>("/", { onRequest: [fastify.authenticate] }, async (request, reply) => {
		const { page = "1", limit = "20" } = request.query;

		const result = await userService.list(
			fastify,
			parseInt(page),
			parseInt(limit)
		);

		return result;
	});

	/**
	 * Get user by ID
	 */
	fastify.get<{
		Params: { id: string };
		Reply: { user: UserDTO } | ErrorResponse;
	}>(
		"/:id",
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			const { id } = request.params;

			const user = await userService.findById(fastify, id);

			if (!user) {
				return reply.status(404).send({ error: "User not found" });
			}

			return { user };
		}
	);

	/**
	 * Update current user status
	 */
	fastify.patch<{
		Body: { status: string };
		Reply: { user: UserDTO } | ErrorResponse;
	}>(
		"/me/status",
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			try {
				const workosUserId = getAuthUserId(request);
				const { status } = request.body;

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

	/**
	 * Update current user profile
	 */
	fastify.patch<{
		Body: UpdateUserRequest;
		Reply: { user: UserDTO } | ErrorResponse;
	}>("/me", { onRequest: [fastify.authenticate] }, async (request, reply) => {
		try {
			const workosUserId = getAuthUserId(request);
			const { display_name, avatar_url } = request.body;

			const user = await userService.update(fastify, {
				workosId: workosUserId,
				display_name,
				avatar_url,
			});

			return { user };
		} catch (err) {
			fastify.log.error(err);
			return reply
				.status(400)
				.send({ error: "Failed to update profile" });
		}
	});
}
