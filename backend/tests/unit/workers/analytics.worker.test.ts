import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Analytics Worker", () => {
	let mockFastify: any;

	beforeEach(() => {
		mockFastify = {
			log: {
				info: vi.fn(),
				error: vi.fn(),
			},
			redis: {
				incr: vi.fn(),
				expire: vi.fn(),
				zadd: vi.fn(),
				zremrangebyscore: vi.fn(),
			},
		};
	});

	describe("handleAnalyticsJob", () => {
		it("should track message-sent event", async () => {
			const timestamp = Date.now();
			const job = {
				data: {
					type: "message-sent",
					userId: "user-123",
					channelId: "channel-456",
					timestamp,
				},
			} as Job;

			const { handleAnalyticsJob } = await import(
				"../../../src/workers/analytics.worker.js"
			);

			const result = await handleAnalyticsJob(job, mockFastify);

			expect(result.tracked).toBe(true);
			expect(mockFastify.redis.incr).toHaveBeenCalledTimes(3);
			expect(mockFastify.redis.expire).toHaveBeenCalledTimes(3);
		});

		it("should track user-active event", async () => {
			const timestamp = Date.now();
			const job = {
				data: {
					type: "user-active",
					userId: "user-123",
					timestamp,
				},
			} as Job;

			const { handleAnalyticsJob } = await import(
				"../../../src/workers/analytics.worker.js"
			);

			const result = await handleAnalyticsJob(job, mockFastify);

			expect(result.tracked).toBe(true);
			expect(mockFastify.redis.zadd).toHaveBeenCalledWith(
				"stats:active-users",
				timestamp,
				"user-123"
			);
			expect(mockFastify.redis.zremrangebyscore).toHaveBeenCalled();
		});

		it("should track channel-activity event", async () => {
			const timestamp = Date.now();
			const job = {
				data: {
					type: "channel-activity",
					channelId: "channel-123",
					timestamp,
				},
			} as Job;

			const { handleAnalyticsJob } = await import(
				"../../../src/workers/analytics.worker.js"
			);

			const result = await handleAnalyticsJob(job, mockFastify);

			expect(result.tracked).toBe(true);
			expect(mockFastify.redis.zadd).toHaveBeenCalledWith(
				"stats:active-channels",
				timestamp,
				"channel-123"
			);
		});

		it("should throw error for unknown analytics type", async () => {
			const job = {
				data: {
					type: "unknown-type",
				},
			} as Job;

			const { handleAnalyticsJob } = await import(
				"../../../src/workers/analytics.worker.js"
			);

			await expect(handleAnalyticsJob(job, mockFastify)).rejects.toThrow(
				"Unknown analytics type: unknown-type"
			);
		});
	});
});
