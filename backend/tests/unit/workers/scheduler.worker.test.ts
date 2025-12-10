import { describe, expect, it, vi } from "vitest";

describe("Scheduler", () => {
	it("should setup scheduled cleanup jobs", async () => {
		const mockQueue = {
			add: vi.fn(),
		};

		const mockFastify = {
			queues: {
				cleanup: mockQueue,
			},
			log: {
				info: vi.fn(),
			},
		} as any;

		const {
			setupScheduledJobs,
		} = await import("../../../src/workers/scheduler.worker.js");

		setupScheduledJobs(mockFastify);

		expect(mockQueue.add).toHaveBeenCalledTimes(2);

		expect(mockQueue.add).toHaveBeenCalledWith(
			"daily-cleanup",
			{
				type: "old-messages",
				olderThanDays: 90,
			},
			{
				repeat: {
					pattern: "0 2 * * *",
				},
			}
		);

		// Weekly inactive users
		expect(mockQueue.add).toHaveBeenCalledWith(
			"weekly-inactive-users",
			{
				type: "inactive-users",
			},
			{
				repeat: {
					pattern: "0 3 * * 0",
				},
			}
		);

		expect(mockFastify.log.info).toHaveBeenCalledWith(
			"✅ Scheduled jobs configured"
		);
	});
});
