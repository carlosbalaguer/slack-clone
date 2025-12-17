import type { FastifyInstance } from "fastify";
import {
	createMessageSchema,
	uuidParamSchema,
} from "../../schemas/message.schema.js";
import { messageService } from "../../services/message.service.js";
import type {
	MessageDTO,
	MessageListDTO,
} from "../../types/dtos/message.dto.js";
import type {
	CreateMessageRequest,
	GetMessagesQuery,
} from "../../types/requests/message.request.js";
import type { ErrorResponse } from "../../types/responses/error.response.js";
import { getAuthUserId } from "../../utils/auth.js";

export async function messagesRoutes(fastify: FastifyInstance) {
	// Get messages for channel
	fastify.get<{
		Params: { channelId: string };
		Querystring: GetMessagesQuery;
		Reply: MessageListDTO | ErrorResponse;
	}>(
		"/channel/:channelId",
		{
			onRequest: [fastify.authenticate],
			config: {
				rateLimit: {
					max: 100,
					timeWindow: "1 minute",
				},
			},
		},
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

			const result: MessageListDTO = await messageService.listByChannel(
				fastify,
				channelId,
				parseInt(limit)
			);

			return result;
		}
	);

	// Create message
	fastify.post<{
		Body: CreateMessageRequest;
		Reply: { message: MessageDTO } | ErrorResponse;
	}>(
		"/",
		{
			onRequest: [fastify.authenticate],
			config: {
				rateLimit: {
					max: 200, // Higher for chat messages
					timeWindow: "1 minute",
				},
			},
		},
		async (request, reply) => {
			try {
				const { channel_id, content } = createMessageSchema.parse(
					request.body
				);
				const workosUserId = getAuthUserId(request);

				const message: MessageDTO = await messageService.create(
					fastify,
					{
						content,
						channelId: channel_id,
						workosUserId,
					}
				);

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
