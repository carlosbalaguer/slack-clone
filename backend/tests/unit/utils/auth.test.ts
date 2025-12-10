import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import {
	getAuthUser,
	getAuthUserId,
	isAuthenticated,
} from "../../../src/utils/auth.js";

describe("Auth Utils", () => {
	const mockUser = {
		id: "user_123",
		email: "test@example.com",
		firstName: "Test",
		lastName: "User",
	};

	describe("getAuthUser", () => {
		it("should return user when authenticated", () => {
			const request = {
				user: mockUser,
			} as any as FastifyRequest;

			const result = getAuthUser(request);

			expect(result).toEqual(mockUser);
			expect(result.id).toBe("user_123");
			expect(result.email).toBe("test@example.com");
		});

		it("should throw error when user is undefined", () => {
			const request = {} as FastifyRequest;

			expect(() => getAuthUser(request)).toThrow(
				"User not authenticated"
			);
		});

		it("should throw error when user id is missing", () => {
			const request = {
				user: { email: "test@example.com" },
			} as any as FastifyRequest;

			expect(() => getAuthUser(request)).toThrow(
				"User not authenticated"
			);
		});

		it("should throw error when user email is missing", () => {
			const request = {
				user: { id: "user_123" },
			} as any as FastifyRequest;

			expect(() => getAuthUser(request)).toThrow(
				"User not authenticated"
			);
		});
	});

	describe("getAuthUserId", () => {
		it("should return user id", () => {
			const request = {
				user: mockUser,
			} as any as FastifyRequest;

			const result = getAuthUserId(request);

			expect(result).toBe("user_123");
			expect(typeof result).toBe("string");
		});

		it("should throw when user not authenticated", () => {
			const request = {} as FastifyRequest;

			expect(() => getAuthUserId(request)).toThrow();
		});
	});

	describe("isAuthenticated", () => {
		it("should return true when user is authenticated", () => {
			const request = {
				user: mockUser,
			} as any as FastifyRequest;

			expect(isAuthenticated(request)).toBe(true);
		});

		it("should return false when user is undefined", () => {
			const request = {} as FastifyRequest;

			expect(isAuthenticated(request)).toBe(false);
		});

		it("should return false when user id is missing", () => {
			const request = {
				user: { email: "test@example.com" },
			} as any as FastifyRequest;

			expect(isAuthenticated(request)).toBe(false);
		});

		it("should return false when user email is missing", () => {
			const request = {
				user: { id: "user_123" },
			} as any as FastifyRequest;

			expect(isAuthenticated(request)).toBe(false);
		});
	});
});
