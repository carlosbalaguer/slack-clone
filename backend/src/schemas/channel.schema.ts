import { z } from "zod";

export const createChannelSchema = z.object({
	name: z
		.string()
		.min(1, "Channel name is required")
		.max(50, "Channel name too long")
		.regex(
			/^[a-z0-9-]+$/,
			"Only lowercase letters, numbers, and hyphens allowed"
		),
	description: z.string().max(200, "Description too long").optional(),
});

export const updateChannelSchema = z.object({
	name: z.string().min(1).max(50).optional(),
	description: z.string().max(200).optional(),
});

export const channelParamsSchema = z.object({
	id: z.uuid("Invalid channel ID"),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type ChannelParams = z.infer<typeof channelParamsSchema>;
