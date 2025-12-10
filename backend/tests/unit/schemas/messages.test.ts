import { describe, expect, it } from "vitest";
import { createMessageSchema } from "../../../src/schemas/message.schema.js";

describe("Messages Schemas", () => {
	describe("createMessageSchema", () => {
		it("should accept valid message data", () => {
			const data = {
				channel_id: "123e4567-e89b-12d3-a456-426614174000",
				content: "Hello, world!",
			};
			const result = createMessageSchema.safeParse(data);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.channel_id).toBe(data.channel_id);
				expect(result.data.content).toBe(data.content);
			}
		});

		it("should reject empty content", () => {
			const data = {
				channel_id: "123e4567-e89b-12d3-a456-426614174000",
				content: "",
			};
			const result = createMessageSchema.safeParse(data);

			expect(result.success).toBe(false);
		});

		it("should reject content that is only whitespace", () => {
			const data = {
				channel_id: "123e4567-e89b-12d3-a456-426614174000",
				content: "   ",
			};
			const result = createMessageSchema.safeParse(data);

			expect(result.success).toBe(false);
		});

		it("should reject missing channel_id", () => {
			const data = {
				content: "Hello, world!",
			};
			const result = createMessageSchema.safeParse(data);

			expect(result.success).toBe(false);
		});

		it("should reject invalid UUID format", () => {
			const data = {
				channel_id: "not-a-uuid",
				content: "Hello, world!",
			};
			const result = createMessageSchema.safeParse(data);

			expect(result.success).toBe(false);
		});

		it("should reject content that is too long", () => {
			const longContent = "a".repeat(5000);
			const data = {
				channel_id: "123e4567-e89b-12d3-a456-426614174000",
				content: longContent,
			};
			const result = createMessageSchema.safeParse(data);

			expect(result.success).toBe(false);
		});

		it("should accept content with emojis", () => {
			const data = {
				channel_id: "123e4567-e89b-12d3-a456-426614174000",
				content: "Hello! 👋 😊 🎉",
			};
			const result = createMessageSchema.safeParse(data);

			expect(result.success).toBe(true);
		});

		it("should accept content with mentions", () => {
			const data = {
				channel_id: "123e4567-e89b-12d3-a456-426614174000",
				content: "Hey @carlos, check this out!",
			};
			const result = createMessageSchema.safeParse(data);

			expect(result.success).toBe(true);
		});
	});
});
