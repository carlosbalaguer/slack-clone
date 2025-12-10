import { Queue, QueueEvents } from "bullmq";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

export const queuePlugin = fp(async (fastify: FastifyInstance) => {
	const redisUrl = process.env.REDIS_URL!;

	if (!redisUrl) {
		throw new Error("REDIS_URL environment variable is required");
	}

	const url = new URL(redisUrl);

	const connection: any = {
		host: url.hostname,
		port: Number(url.port) || 6379,
		password: url.password,
		username: url.username || "default",
	};

	if (url.protocol === "rediss:") {
		connection.tls = {};
	}

	// Create queues
	const notificationsQueue = new Queue("notifications", { connection });
	const analyticsQueue = new Queue("analytics", { connection });
	const cleanupQueue = new Queue("cleanup", { connection });

	// Queue events (monitoring)
	const notificationEvents = new QueueEvents("notifications", { connection });

	notificationEvents.on("completed", ({ jobId }) => {
		fastify.log.info(`✅ Notification job ${jobId} completed`);
	});

	notificationEvents.on("failed", ({ jobId, failedReason }) => {
		fastify.log.error(
			`❌ Notification job ${jobId} failed: ${failedReason}`
		);
	});

	// Decorate fastify with queues
	fastify.decorate("queues", {
		notifications: notificationsQueue,
		analytics: analyticsQueue,
		cleanup: cleanupQueue,
	});

	// Helper methods
	fastify.decorate("addJob", async (queueName, jobName, data, options) => {
		const queue = fastify.queues[queueName];
		return await queue.add(jobName, data, options);
	});

	// Graceful shutdown
	fastify.addHook("onClose", async () => {
		await notificationsQueue.close();
		await analyticsQueue.close();
		await cleanupQueue.close();
		await notificationEvents.close();
	});

	fastify.log.info("✅ Queue system initialized");
});
