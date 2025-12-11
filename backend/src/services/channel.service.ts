import type { FastifyInstance } from "fastify";
import {
	type ChannelDTO,
	type ChannelListDTO,
	toChannelDTO,
	toChannelListDTO,
} from "../types/dtos/channel.dto.js";
import type { CreateChannelServiceParams } from "../types/requests/channel.request.js";

export const channelService = {
	/**
	 * Crea canal y limpia caché centralizadamente
	 */
	async create(
		app: FastifyInstance,
		params: CreateChannelServiceParams
	): Promise<ChannelDTO> {
		const { name, description, created_by } = params;

		const { data: channel, error } = await app.supabase
			.from("channels")
			.insert({
				name,
				description,
				created_by,
			})
			.select()
			.single();

		if (error) throw error;

		// Invalidate cache global
		await app.redis.del("channels:all");

		return toChannelDTO(channel);
	},

	/**
	 * Lista canales (Cache -> DB strategy)
	 */
	async list(app: FastifyInstance): Promise<ChannelListDTO> {
		// 1. Try Cache
		const cached = await app.redis.get("channels:all");
		if (cached) {
			const channels = JSON.parse(cached);
			return toChannelListDTO(channels);
		}

		// 2. Try DB
		const { data: channels } = await app.supabase
			.from("channels")
			.select("*")
			.order("created_at", { ascending: true });

		const channelsList = channels || [];

		// 3. Set Cache (1 hora)
		if (channelsList.length > 0) {
			await app.redis.set(
				"channels:all",
				JSON.stringify(channelsList),
				"EX",
				3600
			);
		}

		return toChannelListDTO(channelsList);
	},

	async findById(
		app: FastifyInstance,
		id: string
	): Promise<ChannelDTO | null> {
		const { data: channel } = await app.supabase
			.from("channels")
			.select("*")
			.eq("id", id)
			.single();

		return channel ? toChannelDTO(channel) : null;
	},
};
