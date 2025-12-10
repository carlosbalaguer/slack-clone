import { z } from "zod";

export const createMessageSchema = z.object({
	channel_id: z.uuid("Invalid channel ID"),
	content: z
		.string()
		.min(1, "Message cannot be empty")
		.max(2000, "Message too long")
		.refine((val) => val.trim().length > 0, {
			message: "Message cannot be only whitespace",
		}),
	reply_to_id: z.string().uuid().optional(),
});

export const updateMessageSchema = z.object({
	content: z.string().min(1).max(2000),
});

export const uuidParamSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID format'),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
