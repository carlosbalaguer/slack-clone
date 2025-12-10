import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Cleanup Worker", () => {
	let mockFastify: any;

	beforeEach(() => {
		mockFastify = {
			log: {
				info: vi.fn(),
				error: vi.fn(),
			},
			redis: {
				keys: vi.fn(),
				pipeline: vi.fn(),
				del: vi.fn(),
			},
			supabase: {
				from: vi.fn(),
			},
		};
	});

	describe("handleCleanupJob", () => {
		it("should cleanup old messages", async () => {
			const job = {
				data: {
					type: "old-messages",
					olderThanDays: 90,
				},
			} as Job;

			// Mock count
			mockFastify.supabase.from.mockReturnValue({
				select: vi.fn().mockReturnValue({
					lt: vi.fn().mockResolvedValue({
						count: 100,
					}),
				}),
				delete: vi.fn().mockReturnValue({
					lt: vi.fn().mockResolvedValue({
						error: null,
					}),
				}),
			});

			const { handleCleanupJob } = await import(
				"../../../src/workers/cleanup.worker.js"
			);

			const result = await handleCleanupJob(job, mockFastify);

			// ⭐ Type narrowing
			expect("deleted" in result).toBe(true);
			if ("deleted" in result) {
				expect(result.deleted).toBe(100);
			}

			expect(mockFastify.log.info).toHaveBeenCalledWith(
				expect.stringContaining("Cleaned up 100 messages")
			);
		});

		it("should return 0 when no messages to cleanup", async () => {
			const job = {
				data: {
					type: "old-messages",
					olderThanDays: 90,
				},
			} as Job;

			mockFastify.supabase.from.mockReturnValue({
				select: vi.fn().mockReturnValue({
					lt: vi.fn().mockResolvedValue({
						count: 0,
					}),
				}),
			});

			const { handleCleanupJob } = await import(
				"../../../src/workers/cleanup.worker.js"
			);

			const result = await handleCleanupJob(job, mockFastify);

			expect("deleted" in result).toBe(true);
			if ("deleted" in result) {
				expect(result.deleted).toBe(0);
			}

			expect(mockFastify.log.info).toHaveBeenCalledWith(
				expect.stringContaining("No messages to clean up")
			);
		});

		it("should cleanup inactive users", async () => {
			const job = {
				data: {
					type: "inactive-users",
				},
			} as Job;

			mockFastify.supabase.from.mockReturnValue({
				select: vi.fn().mockReturnValue({
					lt: vi.fn().mockReturnValue({
						eq: vi.fn().mockResolvedValue({
							count: 50,
						}),
					}),
				}),
				update: vi.fn().mockReturnValue({
					lt: vi.fn().mockReturnValue({
						eq: vi.fn().mockResolvedValue({
							error: null,
						}),
					}),
				}),
			});

			const { handleCleanupJob } = await import(
				"../../../src/workers/cleanup.worker.js"
			);

			const result = await handleCleanupJob(job, mockFastify);

			expect("marked" in result).toBe(true);
			if ("marked" in result) {
				expect(result.marked).toBe(50);
			}

			expect(mockFastify.log.info).toHaveBeenCalledWith(
				expect.stringContaining("Marked 50 users as inactive")
			);
		});

		it("should cleanup expired cache keys", async () => {
			const job = {
				data: {
					type: "expired-cache",
				},
			} as Job;

			mockFastify.redis.keys.mockResolvedValue([
				"cache:key1",
				"cache:key2",
				"cache:key3",
			]);

			const mockPipeline = {
				ttl: vi.fn().mockReturnThis(),
				exec: vi.fn().mockResolvedValue([
					[null, -1], // key1: no TTL
					[null, 300], // key2: has TTL
					[null, -1], // key3: no TTL
				]),
			};

			mockFastify.redis.pipeline.mockReturnValue(mockPipeline);
			mockFastify.redis.del.mockResolvedValue(2);

			const { handleCleanupJob } = await import(
				"../../../src/workers/cleanup.worker.js"
			);

			const result = await handleCleanupJob(job, mockFastify);

			expect("deleted" in result).toBe(true);
			if ("deleted" in result) {
				expect(result.deleted).toBe(2);
				expect(mockFastify.redis.del).toHaveBeenCalledWith(
					"cache:key1",
					"cache:key3"
				);
			}
		});

		it("should return 0 when no cache keys to cleanup", async () => {
			const job = {
				data: {
					type: "expired-cache",
				},
			} as Job;

			mockFastify.redis.keys.mockResolvedValue([]);

			const { handleCleanupJob } = await import(
				"../../../src/workers/cleanup.worker.js"
			);

			const result = await handleCleanupJob(job, mockFastify);

			expect("deleted" in result).toBe(true);
			if ("deleted" in result) {
				expect(result.deleted).toBe(0);
			}
		});

		it("should throw error for unknown cleanup type", async () => {
			const job = {
				data: {
					type: "unknown-type",
				},
			} as Job;

			const { handleCleanupJob } = await import(
				"../../../src/workers/cleanup.worker.js"
			);

			await expect(handleCleanupJob(job, mockFastify)).rejects.toThrow(
				"Unknown cleanup type: unknown-type"
			);
		});
	});
});
