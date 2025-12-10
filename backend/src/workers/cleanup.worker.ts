import type { Job } from "bullmq";
import type { FastifyInstance } from "fastify";

interface CleanupJobData {
	type: "old-messages" | "inactive-users" | "expired-cache";
	olderThanDays?: number;
}

export async function handleCleanupJob(
	job: Job<CleanupJobData>,
	fastify: FastifyInstance
) {
	const { type, olderThanDays } = job.data;

	switch (type) {
		case "old-messages":
			return await cleanupOldMessages(olderThanDays || 90, fastify);

		case "inactive-users":
			return await cleanupInactiveUsers(fastify);

		case "expired-cache":
			return await cleanupExpiredCache(fastify);

		default:
			throw new Error(`Unknown cleanup type: ${type}`);
	}
}

async function cleanupOldMessages(days: number, fastify: FastifyInstance) {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - days);

	// Count first (more efficient for large deletions)
	const { count } = await fastify.supabase
		.from("messages")
		.select("id", { count: "exact", head: true })
		.lt("created_at", cutoffDate.toISOString());

	if (!count || count === 0) {
		fastify.log.info(`🗑️ No messages to clean up`);
		return { deleted: 0 };
	}

	// Delete without returning data (faster)
	const { error } = await fastify.supabase
		.from("messages")
		.delete()
		.lt("created_at", cutoffDate.toISOString());

	if (error) {
		fastify.log.error("Cleanup failed:", undefined, error.message);
		throw error;
	}

	fastify.log.info(`🗑️ Cleaned up ${count} messages older than ${days} days`);

	return { deleted: count };
}

async function cleanupInactiveUsers(fastify: FastifyInstance) {
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	// Count first
	const { count } = await fastify.supabase
		.from("users")
		.select("id", { count: "exact", head: true })
		.lt("updated_at", thirtyDaysAgo.toISOString())
		.eq("status", "online");

	if (!count || count === 0) {
		fastify.log.info(`🗑️ No inactive users to mark`);
		return { marked: 0 };
	}

	// Update
	const { error } = await fastify.supabase
		.from("users")
		.update({ status: "inactive" })
		.lt("updated_at", thirtyDaysAgo.toISOString())
		.eq("status", "online");

	if (error) {
		fastify.log.error("Cleanup failed:", undefined, error.message);
		throw error;
	}

	fastify.log.info(`🗑️ Marked ${count} users as inactive`);

	return { marked: count };
}

async function cleanupExpiredCache(fastify: FastifyInstance) {
	const pattern = "cache:*";
	const keys = await fastify.redis.keys(pattern);

	if (keys.length === 0) {
		fastify.log.info(`🗑️ No cache keys to clean up`);
		return { deleted: 0 };
	}

	let deleted = 0;

	// Process in batches for better performance
	const batchSize = 100;
	for (let i = 0; i < keys.length; i += batchSize) {
		const batch = keys.slice(i, i + batchSize);

		const pipeline = fastify.redis.pipeline();

		for (const key of batch) {
			pipeline.ttl(key);
		}

		const ttls = await pipeline.exec();

		if (!ttls) continue;

		const keysToDelete: string[] = [];

		// ⭐ Fix: Check if batch[index] exists
		ttls.forEach(([err, ttl], index) => {
			const key = batch[index];
			if (!err && ttl === -1 && key) {
				// ← Agregado && key
				keysToDelete.push(key);
			}
		});

		if (keysToDelete.length > 0) {
			await fastify.redis.del(...keysToDelete);
			deleted += keysToDelete.length;
		}
	}

	fastify.log.info(`🗑️ Cleaned up ${deleted} cache keys without TTL`);

	return { deleted };
}
