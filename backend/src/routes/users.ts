import type { FastifyInstance } from "fastify";
import { getAuthUserId } from "../utils/auth.js";

export async function usersRoutes(fastify: FastifyInstance) {
	// Get all users
	fastify.get(
		"/",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			const { data: users } = await fastify.supabase
				.from("users")
				.select("id, username, display_name, avatar_url, status")
				.order("username", { ascending: true });

			return { users: users || [] };
		}
	);

	// Get user by ID
	fastify.get(
		"/:id",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			const { id } = request.params as { id: string };

			const { data: user } = await fastify.supabase
				.from("users")
				.select(
					"id, username, display_name, avatar_url, status, created_at"
				)
				.eq("id", id)
				.single();

			if (!user) {
				return reply.status(404).send({ error: "User not found" });
			}

			return { user };
		}
	);

	// Update current user status
	fastify.patch(
		"/me/status",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const workosUserId = getAuthUserId(request);
				const { status } = request.body as { status: string };

				// Validate status
				const validStatuses = ["online", "away", "busy", "offline"];
				if (!validStatuses.includes(status)) {
					return reply.status(400).send({
						error: "Invalid status. Must be: online, away, busy, or offline",
					});
				}

				const { data: user, error } = await fastify.supabase
					.from("users")
					.update({
						status,
						updated_at: new Date().toISOString(),
					})
					.eq("workos_id", workosUserId)
					.select()
					.single();

				if (error) {
					return reply.status(400).send({ error: error.message });
				}

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
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const workosUserId = getAuthUserId(request);
				const { display_name, avatar_url } = request.body as {
					display_name?: string;
					avatar_url?: string;
				};

				const updateData: any = {
					updated_at: new Date().toISOString(),
				};

				if (display_name !== undefined) {
					updateData.display_name = display_name;
				}

				if (avatar_url !== undefined) {
					updateData.avatar_url = avatar_url;
				}

				const { data: user, error } = await fastify.supabase
					.from("users")
					.update(updateData)
					.eq("workos_id", workosUserId)
					.select()
					.single();

				if (error) {
					return reply.status(400).send({ error: error.message });
				}

				return { user };
			} catch (err) {
				fastify.log.error(err);
				return reply
					.status(400)
					.send({ error: "Failed to update profile" });
			}
		}
	);
}
