import type { FastifyInstance } from "fastify";

interface CreateUserParams {
	workosId: string;
	email: string;
	firstName: string | undefined;
	lastName: string | undefined;
	profilePictureUrl: string | undefined;
}

interface UpdateUserParams {
	workosId: string;
	display_name?: string;
	avatar_url?: string;
	status?: string;
}

export const userService = {
	/**
	 * Busca un usuario por su WorkOS ID.
	 */
	async findByWorkosId(app: FastifyInstance, workosId: string) {
		const { data: user } = await app.supabase
			.from("users")
			.select("*")
			.eq("workos_id", workosId)
			.single();
		return user;
	},

	/**
	 * Busca un usuario o lo crea si no existe.
	 * Maneja la generación segura de usernames para evitar colisiones.
	 */
	async findOrCreate(app: FastifyInstance, params: CreateUserParams) {
		const { workosId, email, firstName, lastName, profilePictureUrl } =
			params;

		// 1. Intentar buscar primero
		const existingUser = await this.findByWorkosId(app, workosId);
		if (existingUser) return existingUser;

		// 2. Generar username base
		const baseUsername = email
			.split("@")[0]!
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "");
		let username = baseUsername;

		// 3. Lógica "Staff": Garantizar unicidad (intento simple)
		// En un sistema real masivo, esto se haría con una secuencia o un servicio de IDs,
		// pero para empezar, probamos si existe.
		const { data: collision } = await app.supabase
			.from("users")
			.select("id")
			.eq("username", username)
			.maybeSingle();

		if (collision) {
			// Si "juan" existe, probamos "juan" + timestamp corto
			username = `${baseUsername}${Math.floor(Date.now() / 1000)
				.toString()
				.slice(-4)}`;
		}

		// 4. Crear usuario
		const { data: newUser, error } = await app.supabase
			.from("users")
			.insert({
				workos_id: workosId,
				email,
				username, // Username seguro
				display_name:
					`${firstName || ""} ${lastName || ""}`.trim() ||
					baseUsername,
				avatar_url: profilePictureUrl,
			})
			.select()
			.single();

		if (error) throw error;
		return newUser;
	},

	/**
	 * Actualiza el perfil o estado del usuario.
	 */
	async update(app: FastifyInstance, params: UpdateUserParams) {
		const { workosId, ...updates } = params;

		const { data: user, error } = await app.supabase
			.from("users")
			.update({
				...updates,
				updated_at: new Date().toISOString(),
			})
			.eq("workos_id", workosId)
			.select()
			.single();

		if (error) throw error;
		return user;
	},

	/**
	 * Listar usuarios con paginación (Staff Level).
	 */
	async list(app: FastifyInstance, page: number = 1, limit: number = 20) {
		const from = (page - 1) * limit;
		const to = from + limit - 1;

		const { data: users, count } = await app.supabase
			.from("users")
			.select("id, username, display_name, avatar_url, status", {
				count: "exact",
			})
			.order("username", { ascending: true })
			.range(from, to);

		return { users: users || [], total: count };
	},

	/**
	 * Busca un usuario por su ID interno (UUID)
	 */
	async findById(app: FastifyInstance, id: string) {
		const { data: user } = await app.supabase
			.from("users")
			.select(
				"id, username, display_name, avatar_url, status, created_at"
			)
			.eq("id", id)
			.single();

		return user;
	},
};
