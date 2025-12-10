import type { FastifyInstance } from "fastify";
import { build } from "../../../src/app.js";

export interface BuildTestAppOptions {
	mockAuth?: boolean;
	mockWorkos?: boolean;
	enableWebSocket?: boolean;
	enableWorkers?: boolean;
	enableScheduler?: boolean;
}

export async function buildTestApp(
	options: BuildTestAppOptions = {}
): Promise<FastifyInstance> {
	const {
		mockAuth = true,
		mockWorkos = true,
		enableWebSocket = false,
		enableWorkers = false,
		enableScheduler = false,
	} = options;

	const app = await build({
		mockAuth,
		mockWorkos,
		enableWebSocket,
		enableWorkers,
		enableScheduler,
	});

	await app.ready();

	return app;
}

export async function closeTestApp(app: FastifyInstance): Promise<void> {
	if (!app) return;

	try {
		const appAny = app as any;

		if (appAny.io) {
			await new Promise<void>((resolve) => {
				try {
					appAny.io.disconnectSockets(true);
					appAny.io.close(() => resolve());
					setTimeout(resolve, 1000);
				} catch (err) {
					resolve();
				}
			});
			delete appAny.io;
		}

		if (appAny.redis) {
			await appAny.redis.quit().catch(() => {});
		}

		if (appAny.queues) {
			const queues = [
				appAny.queues.notifications,
				appAny.queues.analytics,
				appAny.queues.cleanup,
			].filter(Boolean);

			await Promise.all(queues.map((q) => q.close().catch(() => {})));
		}

		await app.close();
	} catch (error) {
		// Silently ignore
	}
}
