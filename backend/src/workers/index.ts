import { Worker } from "bullmq";
import type { FastifyInstance } from "fastify";
import { handleAnalyticsJob } from "./analytics.worker.js";
import { handleCleanupJob } from "./cleanup.worker.js";
import { handleNotificationJob } from "./notifications.worker.js";

export function startWorkers(fastify: FastifyInstance) {
	const redisUrl = process.env.REDIS_URL!;
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

	// Notifications Worker
	const notificationsWorker = new Worker(
		"notifications",
		async (job) => {
			fastify.log.info(`Processing notification job: ${job.name}`);
			return await handleNotificationJob(job, fastify);
		},
		{
			connection,
			concurrency: 5, // Process 5 jobs at once
			limiter: {
				max: 100, // Max 100 jobs
				duration: 1000, // per second
			},
		}
	);

	notificationsWorker.on("completed", (job) => {
		fastify.log.info(`✅ Notification job ${job.id} completed`);
	});

	notificationsWorker.on("failed", (job, err) => {
		fastify.log.error(
			`❌ Notification job ${job?.id} failed:`,
			undefined,
			err.message
		);
	});

	// Analytics Worker
	const analyticsWorker = new Worker(
		"analytics",
		async (job) => {
			fastify.log.info(`Processing analytics job: ${job.name}`);
			return await handleAnalyticsJob(job, fastify);
		},
		{
			connection,
			concurrency: 3,
		}
	);

	analyticsWorker.on("completed", (job) => {
		fastify.log.info(`✅ Analytics job ${job.id} completed`);
	});

	analyticsWorker.on("failed", (job, err) => {
		fastify.log.error(
			`❌ Analytics job ${job?.id} failed:`,
			undefined,
			err.message
		);
	});

	// Cleanup Worker
	const cleanupWorker = new Worker(
		"cleanup",
		async (job) => {
			fastify.log.info(`Processing cleanup job: ${job.name}`);
			return await handleCleanupJob(job, fastify);
		},
		{
			connection,
			concurrency: 1, // Only one cleanup at a time
		}
	);

	cleanupWorker.on("completed", (job) => {
		fastify.log.info(`✅ Cleanup job ${job.id} completed`);
	});

	cleanupWorker.on("failed", (job, err) => {
		fastify.log.error(
			`❌ Cleanup job ${job?.id} failed:`,
			undefined,
			err.message
		);
	});

	fastify.log.info("✅ Workers started");

	// Graceful shutdown
	const shutdown = async () => {
		fastify.log.info("Shutting down workers...");
		await notificationsWorker.close();
		await analyticsWorker.close();
		await cleanupWorker.close();
		fastify.log.info("Workers shut down");
	};

	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);

	return {
		notificationsWorker,
		analyticsWorker,
		cleanupWorker,
		shutdown,
	};
}
