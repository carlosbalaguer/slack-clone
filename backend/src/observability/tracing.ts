import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import type { IncomingMessage, ServerResponse } from "http";

export function initTracing() {
	const serviceName = process.env.SERVICE_NAME || "slack-clone-backend";
	const otlpEndpoint =
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
		"http://localhost:4318/v1/traces";

	const traceExporter = new OTLPTraceExporter({
		url: otlpEndpoint,
	});

	const sdk = new NodeSDK({
		serviceName: serviceName,

		traceExporter,
		instrumentations: [
			getNodeAutoInstrumentations({
				"@opentelemetry/instrumentation-fs": {
					enabled: false,
				},
				"@opentelemetry/instrumentation-http": {
					enabled: true,
					ignoreIncomingRequestHook: (request) => {
						const url = request.url || "";
						return url.includes("/metrics");
					},
					requestHook: (span, request) => {
						// Type guard: solo IncomingMessage tiene 'url'
						if ("url" in request && "method" in request) {
							const incomingMsg = request as IncomingMessage;
							const url = incomingMsg.url || "";
							const method = incomingMsg.method || "";

							span.updateName(`${method} ${url}`);
							span.setAttribute("http.route", url);
							span.setAttribute("http.method", method);
						}
					},
					responseHook: (span, response) => {
						const serverResponse = response as ServerResponse;
						span.setAttribute(
							"http.status_code",
							serverResponse.statusCode
						);
					},
				},
			}),
		],
	});

	sdk.start();

	console.log("🔍 OpenTelemetry tracing initialized");
	console.log(`   Service: ${serviceName}`);
	console.log(`   Exporter: ${otlpEndpoint}`);

	process.on("SIGTERM", () => {
		sdk.shutdown()
			.then(() =>
				console.log("✅ OpenTelemetry SDK shut down successfully")
			)
			.catch((error) =>
				console.error("❌ Error shutting down OpenTelemetry SDK", error)
			)
			.finally(() => process.exit(0));
	});

	return sdk;
}
