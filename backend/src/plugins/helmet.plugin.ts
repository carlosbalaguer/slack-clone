import helmet from "@fastify/helmet";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { getHelmetConfig } from "../config/index.js";

/**
 * Helmet plugin for security headers
 * Configures comprehensive security headers based on environment
 */
async function helmetPlugin(fastify: FastifyInstance) {
	const helmetConfig = getHelmetConfig();

	await fastify.register(helmet, helmetConfig);

	fastify.log.info("✅ Helmet security headers configured");
}

export default fp(helmetPlugin, {
	name: "helmet-plugin",
});