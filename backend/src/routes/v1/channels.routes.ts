import type { FastifyInstance } from "fastify";
import { createChannelSchema } from "../../schemas/channel.schema.js";
import { channelService } from "../../services/channel.service.js";
import type { ChannelDTO, ChannelListDTO } from "../../types/dtos/channel.dto.js";
import type { CreateChannelRequest } from "../../types/requests/channel.request.js";
import type { ErrorResponse } from "../../types/responses/error.response.js";
import { getAuthUserId } from "../../utils/auth.js";

export async function channelsRoutes(fastify: FastifyInstance) {
	/**
	 * Get all channels
	 */
	fastify.get<{
		Reply: ChannelListDTO | ErrorResponse;
	}>("/", { onRequest: [fastify.authenticate] }, async (request, reply) => {
		const result = await channelService.list(fastify);
		return result;
	});

	/**
	 * Create channel
	 */
	fastify.post<{
		Body: CreateChannelRequest;
		Reply: { channel: ChannelDTO } | ErrorResponse;
	}>("/", { onRequest: [fastify.authenticate] }, async (request, reply) => {
		try {
			const { name, description } = createChannelSchema.parse(
				request.body
			);
			const workosUserId = getAuthUserId(request);

			const { data: user } = await fastify.supabase
				.from("users")
				.select("id")
				.eq("workos_id", workosUserId)
				.single();

			if (!user) {
				return reply.status(404).send({ error: "User not found" });
			}

			const channel = await channelService.create(fastify, {
				name,
				description,
				created_by: user.id,
			});

			return { channel };
		} catch (err) {
			fastify.log.error(err);
			return reply
				.status(400)
				.send({ error: "Failed to create channel" });
		}
	});

	/**
	 * Get channel by ID
	 */
	fastify.get<{
		Params: { id: string };
		Reply: { channel: ChannelDTO } | ErrorResponse;
	}>(
		"/:id",
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			const { id } = request.params;
			const channel = await channelService.findById(fastify, id);

			if (!channel) {
				return reply.status(404).send({ error: "Channel not found" });
			}

			return { channel };
		}
	);
}
