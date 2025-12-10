import type { FastifyInstance } from "fastify";
import { createChannelSchema } from "../schemas/channel.schema.js";
import { channelService } from "../services/channel.service.js";
import { getAuthUserId } from "../utils/auth.js";

export async function channelsRoutes(fastify: FastifyInstance) {
	// Get all channels
	fastify.get(
		"/",
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			const channels = await channelService.list(fastify);
			return { channels };
		}
	);

	// Create channel
	fastify.post(
		"/",
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			try {
				const { name, description } = createChannelSchema.parse(
					request.body
				);
				const userId = getAuthUserId(request);

				const channel = await channelService.create(fastify, {
					name,
					description,
					userId,
				});

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
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			const { id } = request.params as { id: string };
			const channel = await channelService.findById(fastify, id);

			if (!channel)
				return reply.status(404).send({ error: "Channel not found" });
			return { channel };
		}
	);
}
