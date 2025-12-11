/**
 * Request para crear un mensaje
 * (Lo que el cliente envía en el body)
 */
export interface CreateMessageRequest {
	channel_id: string; // Mantén snake_case si tu schema Zod lo usa
	content: string;
	reply_to_id?: string;
}

/**
 * Request para obtener mensajes de un canal
 * (Query params)
 */
export interface GetMessagesQuery {
	limit?: string;
}

/**
 * Params internos del service (server-side)
 * Incluye info que el servidor añade (workosUserId)
 */
export interface CreateMessageServiceParams {
	content: string;
	channelId: string;
	workosUserId: string;
}