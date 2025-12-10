import type { FastifyInstance } from "fastify";

export const channelService = {
	/**
	 * Crea canal y limpia caché centralizadamente
	 */
	async create(
		app: FastifyInstance,
		params: { name: string; description: string | undefined; userId: string }
	) {
		const { name, description, userId } = params;

		const { data: channel, error } = await app.supabase
			.from("channels")
			.insert({
				name,
				description,
				created_by: userId,
			})
			.select()
			.single();

		if (error) throw error;

		// Invalidate cache global
		await app.redis.del("channels:all");

		return channel;
	},

	/**
	 * Lista canales (Cache -> DB strategy)
	 */
	async list(app: FastifyInstance) {
		// 1. Try Cache
		const cached = await app.redis.get("channels:all");
		if (cached) return JSON.parse(cached);

		// 2. Try DB
		const { data: channels } = await app.supabase
			.from("channels")
			.select("*")
			.order("created_at", { ascending: true });

		// 3. Set Cache (1 hora)
		if (channels) {
			await app.redis.set(
				"channels:all",
				JSON.stringify(channels),
				"EX",
				3600
			);
		}

		return channels || [];
	},

	async findById(app: FastifyInstance, id: string) {
		const { data: channel } = await app.supabase
			.from("channels")
			.select("*")
			.eq("id", id)
			.single();
		return channel;
	},
};
