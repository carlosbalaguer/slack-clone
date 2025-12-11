/**
 * DTO completo del usuario (para perfil propio)
 */
export interface UserDTO {
	id: string;
	username: string;
	displayName: string;
	email: string;
	avatarUrl: string | null;
	status: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * DTO público del usuario (para listar usuarios)
 * No expone email ni fechas
 */
export interface UserPublicDTO {
	id: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	status: string;
}

/**
 * DTO resumido (ya lo usamos en MessageDTO)
 */
export interface UserSummaryDTO {
	id: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
}

/**
 * DTO para lista de usuarios con paginación
 */
export interface UserListDTO {
	users: UserPublicDTO[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

/**
 * Transforma usuario raw a DTO completo (para perfil propio)
 */
export function toUserDTO(raw: any): UserDTO {
	return {
		id: raw.id,
		username: raw.username,
		displayName: raw.display_name,
		email: raw.email,
		avatarUrl: raw.avatar_url,
		status: raw.status,
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
	};
}

/**
 * Transforma a DTO público (sin email, sin workos_id)
 */
export function toUserPublicDTO(raw: any): UserPublicDTO {
	return {
		id: raw.id,
		username: raw.username,
		displayName: raw.display_name,
		avatarUrl: raw.avatar_url,
		status: raw.status,
	};
}

/**
 * Transforma a DTO resumido
 */
export function toUserSummaryDTO(raw: any): UserSummaryDTO {
	return {
		id: raw.id,
		username: raw.username,
		displayName: raw.display_name,
		avatarUrl: raw.avatar_url,
	};
}

/**
 * Transforma lista de usuarios
 */
export function toUserListDTO(
	rawUsers: any[],
	total: number,
	page: number,
	limit: number
): UserListDTO {
	return {
		users: rawUsers.map(toUserPublicDTO),
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
	};
}