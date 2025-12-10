import { z } from "zod";

export const magicLinkSchema = z.object({
	email: z.string().email("Invalid email format"),
});

export const verifyMagicLinkSchema = z.object({
	email: z.email("Invalid email format"),
	code: z.string().length(6, "Code must be 6 characters"),
});

export const authResponseSchema = z.object({
	user: z.object({
		id: z.string(),
		email: z.string().email(),
		username: z.string(),
		display_name: z.string(),
	}),
	accessToken: z.string(),
});

export const refreshTokenSchema = z.object({
	refreshToken: z.string().min(1, "Refresh token is required"),
});

export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
export type VerifyMagicLinkInput = z.infer<typeof verifyMagicLinkSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
