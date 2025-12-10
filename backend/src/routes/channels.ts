import type { FastifyInstance } from "fastify";
import { createChannelSchema } from "../schemas/channel.schema.js";
import { getAuthUserId } from "../utils/auth.js";

export async function channelsRoutes(fastify: FastifyInstance) {
	// Get all channels
	fastify.get(
		"/",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			const { data: channels } = await fastify.supabase
				.from("channels")
				.select("*")
				.order("created_at", { ascending: true });

			return { channels };
		}
	);

	// Create channel
	fastify.post(
		"/",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const { name, description } = createChannelSchema.parse(
					request.body
				);
				const userId = getAuthUserId(request);

				const { data: channel, error } = await fastify.supabase
					.from("channels")
					.insert({
						name,
						description,
						created_by: userId,
					})
					.select()
					.single();

				if (error) {
					return reply.status(400).send({ error: error.message });
				}

				// Invalidate cache
				await fastify.redis.del("channels:all");

				return { channel };
			} catch (err) {
				fastify.log.error(err);
				return reply
					.status(400)
					.send({ error: "Failed to create channel" });
			}
		}
	);

	// Get channel by ID
	fastify.get(
		"/:id",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			const { id } = request.params as { id: string };
			console.log("Fetching channel with ID:", id);

			const { data: channel } = await fastify.supabase
				.from("channels")
				.select("*")
				.eq("id", id)
				.single();

			if (!channel) {
				return reply.status(404).send({ error: "Channel not found" });
			}

			return { channel };
		}
	);
}
