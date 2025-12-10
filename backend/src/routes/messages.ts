import type { FastifyInstance } from "fastify";
import {
	createMessageSchema,
	uuidParamSchema,
} from "../schemas/message.schema.js";
import { getAuthUserId } from "../utils/auth.js";

export async function messagesRoutes(fastify: FastifyInstance) {
	// Get messages for channel
	fastify.get(
		"/channel/:channelId",
		{
			onRequest: [fastify.authenticate],
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

			const cacheKey = `messages:${channelId}:${limit}`;
			const cached = await fastify.redis.get(cacheKey);

			if (cached) {
				return { messages: JSON.parse(cached), cached: true };
			}

			const { data: messages } = await fastify.supabase
				.from("messages")
				.select(
					`
          *,
          user:users!user_id(id, username, display_name, avatar_url)
        `
				)
				.eq("channel_id", channelId)
				.order("created_at", { ascending: false })
				.limit(parseInt(limit));

			if (messages) {
				await fastify.redis.set(
					cacheKey,
					JSON.stringify(messages),
					"EX",
					30
				);
			}

			return { messages: messages?.reverse() || [] };
		}
	);

	// Create message
	fastify.post(
		"/",
		{
			onRequest: [fastify.authenticate],
		},
		async (request, reply) => {
			try {
				const { channel_id, content } = createMessageSchema.parse(
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

				const { data: message, error } = await fastify.supabase
					.from("messages")
					.insert({
						channel_id,
						user_id: user.id,
						content,
					})
					.select(
						`
            *,
            user:users!user_id(id, username, display_name, avatar_url)
          `
					)
					.single();

				if (error) {
					return reply.status(400).send({ error: error.message });
				}

				// Invalidate cache
				await fastify.redis.del(`messages:${channel_id}:50`);

				// ADD JOBS TO QUEUE
				// 1. Send notifications
				await fastify.addJob("notifications", "new-message", {
					type: "new-message",
					messageId: message.id,
					channelId: channel_id,
					userId: user.id,
					content: message.content,
				});

				// 2. Track analytics
				await fastify.addJob("analytics", "message-sent", {
					type: "message-sent",
					userId: user.id,
					channelId: channel_id,
					timestamp: Date.now(),
				});

				// 3. Check for mentions
				const mentions = content.match(/@(\w+)/g);
				if (mentions) {
					for (const mention of mentions) {
						const username = mention.substring(1);

						// Find mentioned user
						const { data: mentionedUser } = await fastify.supabase
							.from("users")
							.select("id")
							.eq("username", username)
							.single();

						if (mentionedUser) {
							await fastify.addJob("notifications", "mention", {
								type: "mention",
								messageId: message.id,
								mentionedUserId: mentionedUser.id,
								userId: user.id,
								content: message.content,
							});
						}
					}
				}

				return { message };
			} catch (err) {
				fastify.log.error(err);
				return reply
					.status(400)
					.send({ error: "Failed to create message" });
			}
		}
	);
}
