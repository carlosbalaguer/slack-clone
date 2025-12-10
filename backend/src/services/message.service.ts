import type { FastifyInstance } from "fastify";
import { extractMentions } from "../utils/text.js";

interface CreateMessageParams {
	content: string;
	channelId: string;
	workosUserId: string;
}

export const messageService = {
	/**
	 * Crea un mensaje, maneja caché y dispara efectos secundarios (jobs).
	 * Agnóstico al transporte (funciona para REST y WS).
	 */
	async create(app: FastifyInstance, params: CreateMessageParams) {
		const { content, channelId, workosUserId } = params;

		// 1. Resolver Usuario
		const { data: user } = await app.supabase
			.from("users")
			.select("id")
			.eq("workos_id", workosUserId)
			.single();

		if (!user) {
			throw new Error("User not found");
		}

		// 2. Insertar Mensaje
		const { data: message, error } = await app.supabase
			.from("messages")
			.insert({
				channel_id: channelId,
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

		if (error) throw error;

		// 3. Invalidar Caché
		await app.redis.del(`messages:${channelId}:50`);

		// 4. Disparar Jobs
		await Promise.allSettled([
			// Notificaciones
			app.addJob("notifications", "new-message", {
				type: "new-message",
				messageId: message.id,
				channelId,
				userId: user.id,
				content: message.content,
			}),
			// Analytics
			app.addJob("analytics", "message-sent", {
				type: "message-sent",
				userId: user.id,
				channelId,
				timestamp: Date.now(),
			}),
		]);

		// 5. Manejar Menciones
		const mentions = extractMentions(content);
		if (mentions.length > 0) {
			processMentions(app, message, user.id, mentions).catch((err) =>
				app.log.error({ err }, "Failed to process mentions")
			);
		}

		return message;
	},

	/**
	 * Obtiene mensajes de un canal usando estrategia Cache-Aside.
	 */
	async listByChannel(
		app: FastifyInstance,
		channelId: string,
		limit: number = 50
	) {
		const cacheKey = `messages:${channelId}:${limit}`;

		// 1. Try Cache
		const cached = await app.redis.get(cacheKey);
		if (cached) {
			return { messages: JSON.parse(cached), cached: true };
		}

		// 2. Query DB
		const { data: messages } = await app.supabase
			.from("messages")
			.select(
				`*, user:users!user_id(id, username, display_name, avatar_url)`
			)
			.eq("channel_id", channelId)
			.order("created_at", { ascending: false })
			.limit(limit);

		// 3. Set Cache (30 segundos - Hot data)
		if (messages) {
			await app.redis.set(cacheKey, JSON.stringify(messages), "EX", 30);
		}

		return { messages: messages?.reverse() || [], cached: false };
	},
};

async function processMentions(
	app: FastifyInstance,
	message: any,
	senderId: string,
	usernames: string[]
) {
	for (const username of usernames) {
		const { data: mentionedUser } = await app.supabase
			.from("users")
			.select("id")
			.eq("username", username)
			.single();

		if (mentionedUser) {
			await app.addJob("notifications", "mention", {
				type: "mention",
				messageId: message.id,
				mentionedUserId: mentionedUser.id,
				userId: senderId,
				content: message.content,
			});
		}
	}
}
