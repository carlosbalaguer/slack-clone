import { trace } from "@opentelemetry/api";
import { randomUUID } from "crypto";
import type {
	FastifyBaseLogger,
	FastifyRequest,
	RawServerDefault,
} from "fastify";
import pino from "pino";

export function createLogger() {
	const isDevelopment = process.env.NODE_ENV !== "production";
	const logLevel =
		process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info");

	return pino({
		level: logLevel,

		...(isDevelopment && {
			transport: {
				target: "pino-pretty",
				options: {
					colorize: true,
					ignore: "pid,hostname",
					translateTime: "HH:MM:ss Z",
					singleLine: false,
				},
			},
		}),

		base: {
			service: process.env.SERVICE_NAME || "slack-clone-backend",
			environment: process.env.NODE_ENV || "development",
		},
		serializers: {
			req: (req: FastifyRequest) => ({
				method: req.method,
				url: req.url,
				path: req.routeOptions?.url,
				parameters: req.params,
				headers: {
					host: req.headers.host,
					"user-agent": req.headers["user-agent"],
					"content-type": req.headers["content-type"],
				},
			}),
			res: pino.stdSerializers.res,
			err: pino.stdSerializers.err,
		},
		timestamp: pino.stdTimeFunctions.isoTime,
	}) as FastifyBaseLogger;
}

export function generateCorrelationId(): string {
	return randomUUID();
}

export function getTraceContext() {
	const span = trace.getActiveSpan();

	if (span) {
		const spanContext = span.spanContext();
		return {
			traceId: spanContext.traceId,
			spanId: spanContext.spanId,
			traceFlags: spanContext.traceFlags,
		};
	}

	return null;
}

export function createRequestLogger(
	baseLogger: FastifyBaseLogger,
	req: FastifyRequest<any, RawServerDefault>
): FastifyBaseLogger {
	const correlationId = generateCorrelationId();
	const traceContext = getTraceContext();

	return baseLogger.child({
		correlationId,
		...traceContext,
		requestId: req.id,
	});
}
