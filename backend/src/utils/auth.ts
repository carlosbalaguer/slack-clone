import type { FastifyRequest } from "fastify";

/**
 * Type for authenticated user
 */
export interface AuthenticatedUser {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
}

/**
 * Get authenticated user from request
 * Throws error if user not authenticated
 */
export function getAuthUser(request: FastifyRequest): AuthenticatedUser {
	const user = (request as any).user as AuthenticatedUser | undefined;

	if (!user || !user.id || !user.email) {
		throw new Error("User not authenticated");
	}

	return user;
}

/**
 * Get authenticated user ID
 * Throws error if user not authenticated
 */
export function getAuthUserId(request: FastifyRequest): string {
	const user = getAuthUser(request);
	return user.id;
}

/**
 * Check if user is authenticated
 * Returns true if authenticated, false otherwise
 */
export function isAuthenticated(request: FastifyRequest): boolean {
	const user = (request as any).user;
	return !!(user && user.id && user.email);
}
