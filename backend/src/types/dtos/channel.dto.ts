/**
 * DTO completo del canal
 */
export interface ChannelDTO {
	id: string;
	name: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * DTO para lista de canales
 */
export interface ChannelListDTO {
	channels: ChannelDTO[];
	total: number;
}

/**
 * Transforma canal raw a DTO
 */
export function toChannelDTO(raw: any): ChannelDTO {
	return {
		id: raw.id,
		name: raw.name,
		description: raw.description,
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
	};
}

/**
 * Transforma lista de canales
 */
export function toChannelListDTO(rawChannels: any[]): ChannelListDTO {
	return {
		channels: rawChannels.map(toChannelDTO),
		total: rawChannels.length,
	};
}
