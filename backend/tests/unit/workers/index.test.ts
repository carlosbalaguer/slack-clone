import { Worker } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("bullmq", () => {
	const MockWorker = vi.fn(function (
		this: any,
		queueName: string,
		processor: any,
		options: any
	) {
		this.name = queueName;
		this.processor = processor;
		this.options = options;
		this.on = vi.fn().mockReturnThis();
		this.close = vi.fn().mockResolvedValue(undefined);
		return this;
	});

	return { Worker: MockWorker };
});

describe("Workers Index", () => {
	let mockFastify: any;
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.REDIS_URL;
		process.env.REDIS_URL = "redis://localhost:6379";

		vi.clearAllMocks();

		mockFastify = {
			log: {
				info: vi.fn(),
				error: vi.fn(),
			},
		} as any;

		process.removeAllListeners("SIGTERM");
		process.removeAllListeners("SIGINT");
	});

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.REDIS_URL = originalEnv;
		} else {
			delete process.env.REDIS_URL;
		}
	});

	describe("startWorkers", () => {
		it("should create 3 workers (notifications, analytics, cleanup)", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			const result = startWorkers(mockFastify);

			expect(Worker).toHaveBeenCalledTimes(3);
			expect(result).toHaveProperty("notificationsWorker");
			expect(result).toHaveProperty("analyticsWorker");
			expect(result).toHaveProperty("cleanupWorker");
			expect(result).toHaveProperty("shutdown");
		});

		it("should create notifications worker with correct config", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			startWorkers(mockFastify);

			expect(Worker).toHaveBeenCalledWith(
				"notifications",
				expect.any(Function),
				expect.objectContaining({
					concurrency: 5,
					limiter: {
						max: 100,
						duration: 1000,
					},
				})
			);
		});

		it("should create analytics worker with correct config", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			startWorkers(mockFastify);

			expect(Worker).toHaveBeenCalledWith(
				"analytics",
				expect.any(Function),
				expect.objectContaining({
					concurrency: 3,
				})
			);
		});

		it("should create cleanup worker with correct config", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			startWorkers(mockFastify);

			expect(Worker).toHaveBeenCalledWith(
				"cleanup",
				expect.any(Function),
				expect.objectContaining({
					concurrency: 1,
				})
			);
		});

		it("should register event listeners on all workers", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			const result = startWorkers(mockFastify);

			expect(result.notificationsWorker.on).toHaveBeenCalledWith(
				"completed",
				expect.any(Function)
			);
			expect(result.notificationsWorker.on).toHaveBeenCalledWith(
				"failed",
				expect.any(Function)
			);
			expect(result.analyticsWorker.on).toHaveBeenCalledWith(
				"completed",
				expect.any(Function)
			);
			expect(result.analyticsWorker.on).toHaveBeenCalledWith(
				"failed",
				expect.any(Function)
			);
			expect(result.cleanupWorker.on).toHaveBeenCalledWith(
				"completed",
				expect.any(Function)
			);
			expect(result.cleanupWorker.on).toHaveBeenCalledWith(
				"failed",
				expect.any(Function)
			);
		});

		it("should log info when workers start", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			startWorkers(mockFastify);

			expect(mockFastify.log.info).toHaveBeenCalledWith(
				"✅ Workers started"
			);
		});

		it("should register SIGTERM handler", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			startWorkers(mockFastify);

			const listeners = process.listeners("SIGTERM");
			expect(listeners.length).toBeGreaterThan(0);
		});

		it("should register SIGINT handler", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			startWorkers(mockFastify);

			const listeners = process.listeners("SIGINT");
			expect(listeners.length).toBeGreaterThan(0);
		});

		it("should shutdown all workers gracefully", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			const result = startWorkers(mockFastify);

			await result.shutdown();

			expect(result.notificationsWorker.close).toHaveBeenCalled();
			expect(result.analyticsWorker.close).toHaveBeenCalled();
			expect(result.cleanupWorker.close).toHaveBeenCalled();

			expect(mockFastify.log.info).toHaveBeenCalledWith(
				"Shutting down workers..."
			);
			expect(mockFastify.log.info).toHaveBeenCalledWith(
				"Workers shut down"
			);
		});

		it("should parse Redis URL with rediss protocol", async () => {
			process.env.REDIS_URL = "rediss://user:pass@host:6380";

			vi.resetModules();
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			startWorkers(mockFastify);

			const firstCall = (Worker as any).mock.calls[0];
			const options = firstCall[2];

			expect(options.connection).toHaveProperty("tls");
			expect(options.connection.host).toBe("host");
			expect(options.connection.port).toBe(6380);
		});

		it("should parse Redis URL without TLS", async () => {
			process.env.REDIS_URL = "redis://user:pass@host:6379";

			vi.resetModules();
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			startWorkers(mockFastify);

			const firstCall = (Worker as any).mock.calls[0];
			const options = firstCall[2];

			expect(options.connection).not.toHaveProperty("tls");
			expect(options.connection.host).toBe("host");
			expect(options.connection.port).toBe(6379);
		});

		it("should use default port 6379 if not specified", async () => {
			process.env.REDIS_URL = "redis://localhost";

			vi.resetModules();
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			startWorkers(mockFastify);

			const firstCall = (Worker as any).mock.calls[0];
			const options = firstCall[2];

			expect(options.connection.port).toBe(6379);
		});

		it("should execute completed event handler for notifications worker", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			const result = startWorkers(mockFastify);

			// Get the 'completed' handler
			const onMock = result.notificationsWorker.on as any;
			const completedCall = onMock.mock.calls.find(
				(call: any) => call[0] === "completed"
			);
			const completedHandler = completedCall[1];

			// Execute the handler
			const mockJob = { id: "job-123", name: "test-notification" };
			completedHandler(mockJob);

			expect(mockFastify.log.info).toHaveBeenCalledWith(
				"✅ Notification job job-123 completed"
			);
		});

		it("should execute failed event handler for notifications worker", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			const result = startWorkers(mockFastify);

			// Get the 'failed' handler
			const onMock = result.notificationsWorker.on as any;
			const failedCall = onMock.mock.calls.find(
				(call: any) => call[0] === "failed"
			);
			const failedHandler = failedCall[1];

			// Execute the handler
			const mockJob = { id: "job-456", name: "test-notification" };
			const mockError = new Error("Test error");
			failedHandler(mockJob, mockError);

			expect(mockFastify.log.error).toHaveBeenCalledWith(
				"❌ Notification job job-456 failed:",
				undefined,
				"Test error"
			);
		});

		it("should execute completed event handler for analytics worker", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			const result = startWorkers(mockFastify);

			const onMock = result.analyticsWorker.on as any;
			const completedCall = onMock.mock.calls.find(
				(call: any) => call[0] === "completed"
			);
			const completedHandler = completedCall[1];

			const mockJob = { id: "analytics-123", name: "test-analytics" };
			completedHandler(mockJob);

			expect(mockFastify.log.info).toHaveBeenCalledWith(
				"✅ Analytics job analytics-123 completed"
			);
		});

		it("should execute failed event handler for analytics worker", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			const result = startWorkers(mockFastify);

			const onMock = result.analyticsWorker.on as any;
			const failedCall = onMock.mock.calls.find(
				(call: any) => call[0] === "failed"
			);
			const failedHandler = failedCall[1];

			const mockJob = { id: "analytics-456", name: "test-analytics" };
			const mockError = new Error("Analytics error");
			failedHandler(mockJob, mockError);

			expect(mockFastify.log.error).toHaveBeenCalledWith(
				"❌ Analytics job analytics-456 failed:",
				undefined,
				"Analytics error"
			);
		});

		it("should execute completed event handler for cleanup worker", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			const result = startWorkers(mockFastify);

			const onMock = result.cleanupWorker.on as any;
			const completedCall = onMock.mock.calls.find(
				(call: any) => call[0] === "completed"
			);
			const completedHandler = completedCall[1];

			const mockJob = { id: "cleanup-123", name: "test-cleanup" };
			completedHandler(mockJob);

			expect(mockFastify.log.info).toHaveBeenCalledWith(
				"✅ Cleanup job cleanup-123 completed"
			);
		});

		it("should execute failed event handler for cleanup worker", async () => {
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);

			const result = startWorkers(mockFastify);

			const onMock = result.cleanupWorker.on as any;
			const failedCall = onMock.mock.calls.find(
				(call: any) => call[0] === "failed"
			);
			const failedHandler = failedCall[1];

			const mockJob = { id: "cleanup-456", name: "test-cleanup" };
			const mockError = new Error("Cleanup error");
			failedHandler(mockJob, mockError);

			expect(mockFastify.log.error).toHaveBeenCalledWith(
				"❌ Cleanup job cleanup-456 failed:",
				undefined,
				"Cleanup error"
			);
		});

		it("should execute notification processor", async () => {
			// Mock the worker handlers
			vi.mock("../../../src/workers/notifications.worker.js", () => ({
				handleNotificationJob: vi
					.fn()
					.mockResolvedValue({ notified: 1 }),
			}));

			vi.resetModules();
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);
			const { handleNotificationJob } = await import(
				"../../../src/workers/notifications.worker.js"
			);

			const result = startWorkers(mockFastify);

			// Get processor from Worker mock
			const firstCall = (Worker as any).mock.calls.find(
				(call: any) => call[0] === "notifications"
			);
			const processor = firstCall[1];

			const mockJob = {
				id: "job-123",
				name: "test-job",
				data: { type: "new-message" },
			};

			await processor(mockJob);

			expect(mockFastify.log.info).toHaveBeenCalledWith(
				"Processing notification job: test-job"
			);
			expect(handleNotificationJob).toHaveBeenCalledWith(
				mockJob,
				mockFastify
			);
		});

		it("should execute analytics processor", async () => {
			vi.mock("../../../src/workers/analytics.worker.js", () => ({
				handleAnalyticsJob: vi
					.fn()
					.mockResolvedValue({ tracked: true }),
			}));

			vi.resetModules();
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);
			const { handleAnalyticsJob } = await import(
				"../../../src/workers/analytics.worker.js"
			);

			const result = startWorkers(mockFastify);

			const analyticsCall = (Worker as any).mock.calls.find(
				(call: any) => call[0] === "analytics"
			);
			const processor = analyticsCall[1];

			const mockJob = {
				id: "analytics-123",
				name: "analytics-job",
				data: { type: "message-sent" },
			};

			await processor(mockJob);

			expect(mockFastify.log.info).toHaveBeenCalledWith(
				"Processing analytics job: analytics-job"
			);
			expect(handleAnalyticsJob).toHaveBeenCalledWith(
				mockJob,
				mockFastify
			);
		});

		it("should execute cleanup processor", async () => {
			vi.mock("../../../src/workers/cleanup.worker.js", () => ({
				handleCleanupJob: vi.fn().mockResolvedValue({ deleted: 10 }),
			}));

			vi.resetModules();
			const { startWorkers } = await import(
				"../../../src/workers/index.js"
			);
			const { handleCleanupJob } = await import(
				"../../../src/workers/cleanup.worker.js"
			);

			const result = startWorkers(mockFastify);

			const cleanupCall = (Worker as any).mock.calls.find(
				(call: any) => call[0] === "cleanup"
			);
			const processor = cleanupCall[1];

			const mockJob = {
				id: "cleanup-123",
				name: "cleanup-job",
				data: { type: "old-messages" },
			};

			await processor(mockJob);

			expect(mockFastify.log.info).toHaveBeenCalledWith(
				"Processing cleanup job: cleanup-job"
			);
			expect(handleCleanupJob).toHaveBeenCalledWith(mockJob, mockFastify);
		});
	});
});
