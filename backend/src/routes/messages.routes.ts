import type { FastifyInstance } from "fastify";
import {
	createMessageSchema,
	uuidParamSchema,
} from "../schemas/message.schema.js";
import { messageService } from "../services/message.service.js";
import { getAuthUserId } from "../utils/auth.js";

export async function messagesRoutes(fastify: FastifyInstance) {
	// Get messages for channel
	fastify.get(
		"/channel/:channelId",
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			const validatedParams = uuidParamSchema.safeParse(request.params);

			if (!validatedParams.success) {
				return reply.status(400).send({
					error: "Validation failed",
					details: validatedParams.error,
				});
			}

			const { channelId } = validatedParams.data;
			const { limit = "50" } = request.query as { limit?: string };

			const result = await messageService.listByChannel(
				fastify,
				channelId,
				parseInt(limit)
			);

			return result;
		}
	);

	// Create message
	fastify.post(
		"/",
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			try {
				const { channel_id, content } = createMessageSchema.parse(
					request.body
				);
				const workosUserId = getAuthUserId(request);

				const message = await messageService.create(fastify, {
					content,
					channelId: channel_id,
					workosUserId,
				});

				return { message };
			} catch (err: any) {
				if (err.message === "User not found") {
					return reply.status(404).send({ error: "User not found" });
				}
				fastify.log.error(err);
				return reply
					.status(400)
					.send({ error: "Failed to create message" });
			}
		}
	);
}
