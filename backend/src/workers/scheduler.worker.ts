import type { FastifyInstance } from "fastify";

export function setupScheduledJobs(fastify: FastifyInstance) {
  // Cleanup old messages (daily at 2 AM)
  fastify.queues.cleanup.add(
    "daily-cleanup",
    {
      type: "old-messages",
      olderThanDays: 90,
    },
    {
      repeat: {
        pattern: "0 2 * * *", // Cron: 2 AM every day
      },
    }
  );

  // Mark inactive users (weekly on Sunday at 3 AM)
  fastify.queues.cleanup.add(
    "weekly-inactive-users",
    {
      type: "inactive-users",
    },
    {
      repeat: {
        pattern: "0 3 * * 0", // Cron: 3 AM every Sunday
      },
    }
  );

  fastify.log.info("✅ Scheduled jobs configured");
}