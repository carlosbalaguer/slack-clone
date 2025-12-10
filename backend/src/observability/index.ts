import { createLogger } from "./logger.js";
import * as metrics from "./metrics.js";
import { initSentry } from "./sentry.js";
import { initTracing } from "./tracing.js";

export const tracingSdk = initTracing();
export const sentry = initSentry();
export const logger = createLogger();

export { metrics };

export {
	createRequestLogger,
	generateCorrelationId,
	getTraceContext,
} from "./logger.js";
