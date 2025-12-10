import type { Job } from "bullmq";
import type { FastifyInstance } from "fastify";

interface AnalyticsJobData {
  type: "message-sent" | "user-active" | "channel-activity";
  userId?: string;
  channelId?: string;
  timestamp?: number;
}

export async function handleAnalyticsJob(
  job: Job<AnalyticsJobData>,
  fastify: FastifyInstance
) {
  const { type, userId, channelId, timestamp } = job.data;

  switch (type) {
    case "message-sent":
      return await trackMessageSent({ userId, channelId, timestamp }, fastify);

    case "user-active":
      return await trackUserActivity({ userId, timestamp }, fastify);

    case "channel-activity":
      return await trackChannelActivity({ channelId, timestamp }, fastify);

    default:
      throw new Error(`Unknown analytics type: ${type}`);
  }
}

async function trackMessageSent(data: any, fastify: FastifyInstance) {
  const { userId, channelId, timestamp } = data;
  const date = new Date(timestamp).toISOString().split("T")[0]; // YYYY-MM-DD

  await Promise.all([
    fastify.redis.incr(`stats:messages:${date}`),
    fastify.redis.incr(`stats:user:${userId}:messages:${date}`),
    fastify.redis.incr(`stats:channel:${channelId}:messages:${date}`),
    fastify.redis.expire(`stats:messages:${date}`, 30 * 24 * 60 * 60),
    fastify.redis.expire(
      `stats:user:${userId}:messages:${date}`,
      30 * 24 * 60 * 60
    ),
    fastify.redis.expire(
      `stats:channel:${channelId}:messages:${date}`,
      30 * 24 * 60 * 60
    ),
  ]);

  return { tracked: true };
}

async function trackUserActivity(data: any, fastify: FastifyInstance) {
  const { userId, timestamp } = data;

  // Add to active users set (last 24 hours)
  await fastify.redis.zadd("stats:active-users", timestamp, userId);

  // Remove users inactive for >24 hours
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  await fastify.redis.zremrangebyscore("stats:active-users", 0, oneDayAgo);

  return { tracked: true };
}

async function trackChannelActivity(data: any, fastify: FastifyInstance) {
  const { channelId, timestamp } = data;

  // Add to active channels set
  await fastify.redis.zadd("stats:active-channels", timestamp, channelId);

  return { tracked: true };
}