import { WorkOS } from "@workos-inc/node";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import * as jose from "jose";
import { WorkOSClient } from "../utils/workos-client.js";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

declare module "fastify" {
	interface FastifyInstance {
		workos: WorkOS;
		workosClient: WorkOSClient;
	}
}

export const workosAuthPlugin = fp(async (fastify: FastifyInstance) => {
	fastify.decorate("workos", workos);

	const workosClient = new WorkOSClient(fastify);
	fastify.decorate("workosClient", workosClient);

	// Create JWKS once (more efficient)
	const JWKS = jose.createRemoteJWKSet(
		new URL(
			`https://api.workos.com/sso/jwks/${process.env.WORKOS_CLIENT_ID}`
		)
	);

	fastify.decorate(
		"authenticate",
		async (request: FastifyRequest, reply: FastifyReply) => {
			const authHeader = request.headers.authorization;

			if (!authHeader?.startsWith("Bearer ")) {
				return reply
					.status(401)
					.send({ error: "Missing authorization" });
			}

			const token = authHeader.replace("Bearer ", "");

			try {
				// Validate JWT (verifies signature, expiration, issuer)
				const { payload } = await jose.jwtVerify(token, JWKS, {
					issuer: "https://api.workos.com",
				});

				const userId = payload.sub as string;

				if (!userId) {
					return reply.status(401).send({ error: "Invalid token" });
				}

				// Set minimal user info (rest comes from Supabase in routes)
				request.user = {
					id: userId,
					email: "",
					firstName: "",
					lastName: "",
				};

				fastify.log.info(`✅ Token validated for user: ${userId}`);
			} catch (err) {
				fastify.log.error("Token validation failed:", undefined, err);
				return reply
					.status(401)
					.send({ error: "Authentication failed" });
			}
		}
	);

	fastify.log.info(
		"✅ WorkOS Auth plugin registered (with circuit breakers)"
	);
});
