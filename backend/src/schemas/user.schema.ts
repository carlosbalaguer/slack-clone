import { z } from "zod";

export const updateUserProfileSchema = z.object({
	display_name: z.string().min(1).max(100).optional(),
	avatar_url: z.url("Invalid URL").optional(),
});

export const updateUserStatusSchema = z.object({
	status: z.enum(["online", "away", "busy", "offline"]),
});

export const userParamsSchema = z.object({
	id: z.string().uuid("Invalid user ID"),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
