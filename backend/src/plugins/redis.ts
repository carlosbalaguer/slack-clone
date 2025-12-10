import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Redis } from "ioredis";

export const redisPlugin = fp(async (fastify: FastifyInstance) => {
	const redisUrl = process.env.REDIS_URL!;

	if (!redisUrl) {
		throw new Error("REDIS_URL environment variable is required");
	}

	const url = new URL(redisUrl);

	const options: any = {
		host: url.hostname,
		port: Number(url.port) || 6379,
		password: url.password,
		username: url.username || "default",
		family: 4,
		maxRetriesPerRequest: 3,
		retryStrategy: (times: number) => {
			const delay = Math.min(times * 50, 2000);
			return delay;
		},
		enableReadyCheck: false,
		enableOfflineQueue: true,
	};

	// Solo agregar TLS si es rediss://
	if (url.protocol === "rediss:") {
		options.tls = {};
	}

	const redis = new Redis(options);

	redis.on("connect", () => {
		fastify.log.info("✅ Redis connecting...");
	});

	redis.on("ready", () => {
		fastify.log.info("✅ Redis ready (Upstash with ioredis)");
	});

	redis.on("error", (err) => {
		fastify.log.error("Redis error:", undefined, err.message);
	});

	redis.on("close", () => {
		fastify.log.info("Redis connection closed");
	});

	try {
		await redis.ping();
		fastify.log.info("✅ Redis ping successful");
	} catch (err) {
		fastify.log.error("Redis connection failed:", undefined, (err as Error).message);
		throw err;
	}

	fastify.decorate("redis", redis);

	fastify.addHook("onClose", async () => {
		await redis.quit();
	});
});
