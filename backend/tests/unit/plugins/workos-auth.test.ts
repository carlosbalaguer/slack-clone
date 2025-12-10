import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as jose from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv(
	"WORKOS_CLIENT_ID",
	process.env.WORKOS_CLIENT_ID || "client_01JBVM2HH2WN5HY7ZZMZ6KD1PA"
);
vi.stubEnv("WORKOS_API_KEY", process.env.WORKOS_API_KEY || "test_api_key");

vi.mock("jose", () => ({
	createRemoteJWKSet: vi.fn(() => "mock-jwks"),
	jwtVerify: vi.fn(),
	errors: {
		JWTExpired: class JWTExpired extends Error {
			claim: string;
			reason: string;
			payload: jose.JWTPayload;
			constructor(
				message: string,
				payload: jose.JWTPayload,
				claim: string = "exp",
				reason: string = "expired"
			) {
				super(message);
				this.name = "JWTExpired";
				this.payload = payload;
				this.claim = claim;
				this.reason = reason;
			}
		},
		JWTClaimValidationFailed: class JWTClaimValidationFailed extends Error {
			claim: string;
			reason: string;
			payload: jose.JWTPayload;
			constructor(
				message: string,
				payload: jose.JWTPayload,
				claim: string = "iss",
				reason: string = "validation failed"
			) {
				super(message);
				this.name = "JWTClaimValidationFailed";
				this.payload = payload;
				this.claim = claim;
				this.reason = reason;
			}
		},
	},
}));

vi.mock("@workos-inc/node", () => {
	return {
		WorkOS: vi.fn(function (this: any) {
			this.userManagement = { getUser: vi.fn() };
			return this;
		}),
	};
});

import { workosAuthPlugin } from "../../../src/plugins/workos-auth.js";

describe("workosAuthPlugin", () => {
	let app: FastifyInstance;
	let mockRequest: Partial<FastifyRequest>;
	let mockReply: FastifyReply;
	let sendMock: ReturnType<typeof vi.fn>;
	let statusMock: ReturnType<typeof vi.fn>;
	let mockLogger: any;

	beforeEach(() => {
		sendMock = vi.fn();
		statusMock = vi.fn(() => ({ send: sendMock }));

		mockLogger = {
			info: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
			debug: vi.fn(),
		};

		mockRequest = {
			headers: {},
		};

		mockReply = {
			status: statusMock,
		} as any;
	});

	describe("Plugin Registration", () => {
		it("should register plugin and decorate fastify with workos", async () => {
			const mockFastify = {
				decorate: vi.fn(),
				log: mockLogger,
			} as any;

			await workosAuthPlugin(mockFastify);

			expect(mockFastify.decorate).toHaveBeenCalledWith(
				"workos",
				expect.any(Object)
			);
		});

		it("should register plugin and decorate fastify with authenticate function", async () => {
			const mockFastify = {
				decorate: vi.fn(),
				log: mockLogger,
			} as any;

			await workosAuthPlugin(mockFastify);

			expect(mockFastify.decorate).toHaveBeenCalledWith(
				"authenticate",
				expect.any(Function)
			);
		});

		it("should create JWKS with correct WorkOS URL", async () => {
			const mockFastify = {
				decorate: vi.fn(),
				log: mockLogger,
			} as any;

			await workosAuthPlugin(mockFastify);

			expect(jose.createRemoteJWKSet).toHaveBeenCalledWith(
				new URL(
					"https://api.workos.com/sso/jwks/client_01JBVM2HH2WN5HY7ZZMZ6KD1PA"
				)
			);
		});
	});

	describe("Authentication", () => {
		beforeEach(async () => {
			app = {
				decorate: vi.fn((name: string, value: any) => {
					(app as any)[name] = value;
				}),
				log: mockLogger,
			} as any;
			await workosAuthPlugin(app);
		});

		it("should reject request without authorization header", async () => {
			mockRequest.headers = {};

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
			expect(sendMock).toHaveBeenCalledWith({
				error: "Missing authorization",
			});
		});

		it("should reject request without Bearer prefix", async () => {
			mockRequest.headers = {
				authorization: "InvalidToken",
			};

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
			expect(sendMock).toHaveBeenCalledWith({
				error: "Missing authorization",
			});
		});

		it("should reject invalid JWT token", async () => {
			mockRequest.headers = {
				authorization: "Bearer invalid-token",
			};

			vi.mocked(jose.jwtVerify).mockRejectedValueOnce(
				new Error("Invalid token")
			);

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
			expect(sendMock).toHaveBeenCalledWith({
				error: "Authentication failed",
			});
		});

		it("should reject expired JWT token", async () => {
			mockRequest.headers = {
				authorization: "Bearer expired-token",
			};

			vi.mocked(jose.jwtVerify).mockRejectedValueOnce(
				new jose.errors.JWTExpired(
					"Token expired",
					{ sub: "user_123", exp: 1234567890 },
					"exp"
				)
			);

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
			expect(sendMock).toHaveBeenCalledWith({
				error: "Authentication failed",
			});
		});

		it("should reject JWT without sub claim", async () => {
			mockRequest.headers = {
				authorization: "Bearer valid-token-no-sub",
			};

			vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
				payload: { iss: "workos" },
				protectedHeader: { alg: "RS256" },
				key: {} as any,
			});

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
			expect(sendMock).toHaveBeenCalledWith({
				error: "Invalid token",
			});
		});

		it("should accept valid JWT and set request.user", async () => {
			mockRequest.headers = {
				authorization: "Bearer valid-token",
			};

			vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
				payload: { sub: "user_123", iss: "workos" },
				protectedHeader: { alg: "RS256" },
				key: {} as any,
			});

			await (app as any).authenticate(mockRequest, mockReply);

			expect(mockRequest.user).toEqual({
				id: "user_123",
				email: "",
				firstName: "",
				lastName: "",
			});
			expect(statusMock).not.toHaveBeenCalled();
		});

		it("should verify JWT with correct issuer", async () => {
			mockRequest.headers = {
				authorization: "Bearer valid-token",
			};

			vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
				payload: { sub: "user_123", iss: "workos" },
				protectedHeader: { alg: "RS256" },
				key: {} as any,
			});

			await (app as any).authenticate(mockRequest, mockReply);

			expect(jose.jwtVerify).toHaveBeenCalledWith(
				"valid-token",
				"mock-jwks",
				{
					issuer: "https://api.workos.com",
				}
			);
		});

		it("should handle JWTClaimValidationFailed error", async () => {
			mockRequest.headers = {
				authorization: "Bearer invalid-claim-token",
			};

			vi.mocked(jose.jwtVerify).mockRejectedValueOnce(
				new jose.errors.JWTClaimValidationFailed(
					"claim validation failed",
					{ sub: "user_123", iss: "wrong-issuer" },
					"issuer",
					"incorrect issuer"
				)
			);

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
			expect(sendMock).toHaveBeenCalledWith({
				error: "Authentication failed",
			});
		});

		it("should strip Bearer prefix correctly", async () => {
			mockRequest.headers = {
				authorization: "Bearer token123",
			};

			vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
				payload: { sub: "user_123" },
				protectedHeader: { alg: "RS256" },
				key: {} as any,
			});

			await (app as any).authenticate(mockRequest, mockReply);

			expect(jose.jwtVerify).toHaveBeenCalledWith(
				"token123",
				"mock-jwks",
				{
					issuer: "https://api.workos.com",
				}
			);
		});

		it("should handle authorization header with extra spaces", async () => {
			mockRequest.headers = {
				authorization: "Bearer   token-with-spaces  ",
			};

			vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
				payload: { sub: "user_123" },
				protectedHeader: { alg: "RS256" },
				key: {} as any,
			});

			await (app as any).authenticate(mockRequest, mockReply);

			expect(mockRequest.user).toEqual({
				id: "user_123",
				email: "",
				firstName: "",
				lastName: "",
			});
		});
	});

	describe("Error Handling", () => {
		beforeEach(async () => {
			app = {
				decorate: vi.fn((name: string, value: any) => {
					(app as any)[name] = value;
				}),
				log: mockLogger,
			} as any;
			await workosAuthPlugin(app);
		});

		it("should handle network errors gracefully", async () => {
			mockRequest.headers = {
				authorization: "Bearer network-error-token",
			};

			vi.mocked(jose.jwtVerify).mockRejectedValueOnce(
				new Error("Network error: ECONNREFUSED")
			);

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
			expect(sendMock).toHaveBeenCalledWith({
				error: "Authentication failed",
			});
		});

		it("should handle JWKS fetch errors", async () => {
			mockRequest.headers = {
				authorization: "Bearer jwks-error-token",
			};

			vi.mocked(jose.jwtVerify).mockRejectedValueOnce(
				new Error("JWKS endpoint not reachable")
			);

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
		});

		it("should handle malformed JWT", async () => {
			mockRequest.headers = {
				authorization: "Bearer this.is.malformed",
			};

			vi.mocked(jose.jwtVerify).mockRejectedValueOnce(
				new Error("Malformed JWT")
			);

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
		});
	});

	describe("Edge Cases", () => {
		beforeEach(async () => {
			app = {
				decorate: vi.fn((name: string, value: any) => {
					(app as any)[name] = value;
				}),
				log: mockLogger,
			} as any;
			await workosAuthPlugin(app);
		});

		it("should reject empty authorization header", async () => {
			mockRequest.headers = {
				authorization: "",
			};

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
			expect(sendMock).toHaveBeenCalledWith({
				error: "Missing authorization",
			});
		});

		it("should reject Bearer without token", async () => {
			mockRequest.headers = {
				authorization: "Bearer",
			};

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
		});

		it("should reject lowercase bearer", async () => {
			mockRequest.headers = {
				authorization: "bearer valid-token",
			};

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
			expect(sendMock).toHaveBeenCalledWith({
				error: "Missing authorization",
			});
		});

		it("should handle very long tokens", async () => {
			const longToken = "A".repeat(10000);
			mockRequest.headers = {
				authorization: `Bearer ${longToken}`,
			};

			vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
				payload: { sub: "user_123" },
				protectedHeader: { alg: "RS256" },
				key: {} as any,
			});

			await (app as any).authenticate(mockRequest, mockReply);

			expect(mockRequest.user).toEqual({
				id: "user_123",
				email: "",
				firstName: "",
				lastName: "",
			});
		});

		it("should handle sub claim as number", async () => {
			mockRequest.headers = {
				authorization: "Bearer token-with-number-sub",
			};

			vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
				payload: { sub: 12345 as any },
				protectedHeader: { alg: "RS256" },
				key: {} as any,
			});

			await (app as any).authenticate(mockRequest, mockReply);

			expect(mockRequest.user).toEqual({
				id: 12345,
				email: "",
				firstName: "",
				lastName: "",
			});
		});

		it("should reject null sub claim", async () => {
			mockRequest.headers = {
				authorization: "Bearer token-null-sub",
			};

			vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
				payload: { sub: null as any },
				protectedHeader: { alg: "RS256" },
				key: {} as any,
			});

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
			expect(sendMock).toHaveBeenCalledWith({
				error: "Invalid token",
			});
		});

		it("should reject undefined sub claim", async () => {
			mockRequest.headers = {
				authorization: "Bearer token-undefined-sub",
			};

			vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
				payload: { iss: "workos" }, // No sub property at all
				protectedHeader: { alg: "RS256" },
				key: {} as any,
			});

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
		});

		it("should reject empty string token", async () => {
			mockRequest.headers = {
				authorization: "Bearer ",
			};

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
		});

		it("should handle multiple Bearer prefixes", async () => {
			mockRequest.headers = {
				authorization: "Bearer Bearer token123",
			};

			vi.mocked(jose.jwtVerify).mockRejectedValueOnce(
				new Error("Invalid token")
			);

			await (app as any).authenticate(mockRequest, mockReply);

			expect(statusMock).toHaveBeenCalledWith(401);
		});

		it("should handle special characters in token", async () => {
			mockRequest.headers = {
				authorization: "Bearer token-with-$pecial-ch@rs!",
			};

			vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
				payload: { sub: "user_123" },
				protectedHeader: { alg: "RS256" },
				key: {} as any,
			});

			await (app as any).authenticate(mockRequest, mockReply);

			expect(mockRequest.user).toEqual({
				id: "user_123",
				email: "",
				firstName: "",
				lastName: "",
			});
		});
	});
});
