import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, closeTestApp } from "../helpers/test-app.js";

describe("Health Endpoint - Integration", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	it("GET /health should return 200 with correct structure", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/health",
		});

		expect(response.statusCode).toBe(200);

		const body = response.json();
		expect(body).toHaveProperty("status", "ok");
		expect(body).toHaveProperty("timestamp");
		expect(body).toHaveProperty("uptime");
		expect(typeof body.uptime).toBe("number");
	});

	it("should return valid ISO timestamp", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/health",
		});

		const body = response.json();
		const timestamp = new Date(body.timestamp);

		expect(timestamp.toString()).not.toBe("Invalid Date");
		expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
	});

	it("should return positive uptime", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/health",
		});

		const body = response.json();
		expect(body.uptime).toBeGreaterThan(0);
	});
});
