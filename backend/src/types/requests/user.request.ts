/**
 * Request para actualizar perfil de usuario
 */
export interface UpdateUserRequest {
	display_name?: string;
	avatar_url?: string;
	status?: string;
}

/**
 * Query params para listar usuarios
 */
export interface ListUsersQuery {
	page?: string;
	limit?: string;
}

/**
 * Params internos del service (con workosId)
 */
export interface FindOrCreateUserParams {
	workosId: string;
	email: string;
	firstName?: string;
	lastName?: string;
	profilePictureUrl?: string;
}

export interface UpdateUserServiceParams {
	workosId: string;
	display_name?: string;
	avatar_url?: string;
	status?: string;
}