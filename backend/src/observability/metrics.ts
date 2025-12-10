import promClient from "prom-client";

// Crear registry
export const register = new promClient.Registry();

// Default metrics (CPU, memory, event loop, etc)
promClient.collectDefaultMetrics({ register });

// ============================================
// HTTP METRICS
// ============================================
export const httpRequestDuration = new promClient.Histogram({
	name: "http_request_duration_seconds",
	help: "Duration of HTTP requests in seconds",
	labelNames: ["method", "route", "status_code"],
	buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
	registers: [register],
});

export const httpRequestsTotal = new promClient.Counter({
	name: "http_requests_total",
	help: "Total number of HTTP requests",
	labelNames: ["method", "route", "status_code"],
	registers: [register],
});

// ============================================
// WEBSOCKET METRICS
// ============================================
export const websocketConnections = new promClient.Gauge({
	name: "websocket_connections_active",
	help: "Number of active WebSocket connections",
	registers: [register],
});

export const websocketMessages = new promClient.Counter({
	name: "websocket_messages_total",
	help: "Total number of WebSocket messages",
	labelNames: ["event", "direction"], // direction: inbound/outbound
	registers: [register],
});

// ============================================
// QUEUE METRICS
// ============================================
export const queueJobsProcessed = new promClient.Counter({
	name: "queue_jobs_processed_total",
	help: "Total number of queue jobs processed",
	labelNames: ["queue", "status"], // status: completed/failed
	registers: [register],
});

export const queueJobDuration = new promClient.Histogram({
	name: "queue_job_duration_seconds",
	help: "Duration of queue job processing in seconds",
	labelNames: ["queue"],
	buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
	registers: [register],
});

export const queueJobsWaiting = new promClient.Gauge({
	name: "queue_jobs_waiting",
	help: "Number of jobs waiting in queue",
	labelNames: ["queue"],
	registers: [register],
});

// ============================================
// DATABASE METRICS
// ============================================
export const databaseQueryDuration = new promClient.Histogram({
	name: "database_query_duration_seconds",
	help: "Duration of database queries in seconds",
	labelNames: ["table", "operation"],
	buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
	registers: [register],
});

export const databaseErrors = new promClient.Counter({
	name: "database_errors_total",
	help: "Total number of database errors",
	labelNames: ["table", "operation"],
	registers: [register],
});

// ============================================
// CACHE METRICS
// ============================================
export const cacheHits = new promClient.Counter({
	name: "cache_hits_total",
	help: "Total number of cache hits",
	labelNames: ["cache_key"],
	registers: [register],
});

export const cacheMisses = new promClient.Counter({
	name: "cache_misses_total",
	help: "Total number of cache misses",
	labelNames: ["cache_key"],
	registers: [register],
});

// ============================================
// BUSINESS METRICS
// ============================================
export const activeUsers = new promClient.Gauge({
	name: "active_users",
	help: "Number of active users in the last 5 minutes",
	registers: [register],
});

export const messagesCreated = new promClient.Counter({
	name: "messages_created_total",
	help: "Total number of messages created",
	labelNames: ["channel_id"],
	registers: [register],
});

console.log("📊 Prometheus metrics initialized");
