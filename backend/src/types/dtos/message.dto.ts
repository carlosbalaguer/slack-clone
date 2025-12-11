/**
 * DTO resumido del usuario (para incluir en mensajes)
 */
export interface UserSummaryDTO {
	id: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
}

/**
 * DTO para un mensaje individual
 */
export interface MessageDTO {
	id: string;
	content: string;
	channelId: string;
	createdAt: string;
	updatedAt: string;
	user: UserSummaryDTO;
	// Futuros: replyToId, reactions, attachments
}

/**
 * DTO para lista de mensajes (con info de cache)
 */
export interface MessageListDTO {
	messages: MessageDTO[];
	cached: boolean;
}

/**
 * Transforma mensaje raw de Supabase a DTO
 */
export function toMessageDTO(raw: any): MessageDTO {
	return {
		id: raw.id,
		content: raw.content,
		channelId: raw.channel_id,
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
		user: {
			id: raw.user.id,
			username: raw.user.username,
			displayName: raw.user.display_name,
			avatarUrl: raw.user.avatar_url,
		},
	};
}

/**
 * Transforma array de mensajes
 */
export function toMessageListDTO(
	rawMessages: any[],
	cached: boolean = false
): MessageListDTO {
	return {
		messages: rawMessages.map(toMessageDTO),
		cached,
	};
}