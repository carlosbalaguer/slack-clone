/**
 * Request para crear canal
 */
export interface CreateChannelRequest {
	name: string;
	description?: string;
	is_private?: boolean;
}

/**
 * Params internos del service
 */
export interface CreateChannelServiceParams {
	name: string;
	description?: string | undefined;
	is_private?: boolean | undefined;
	created_by: string;
}
