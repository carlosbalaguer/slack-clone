import { describe, expect, it } from "vitest";
import {
	createChannelSchema,
	updateChannelSchema,
} from "../../../src/schemas/channel.schema.js";

describe("Channels Schemas", () => {
	describe("createChannelSchema", () => {
		it("should accept valid channel data", () => {
			const data = {
				name: "general",
				description: "General discussion channel",
			};
			const result = createChannelSchema.safeParse(data);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.name).toBe("general");
				expect(result.data.description).toBe(
					"General discussion channel"
				);
			}
		});

		it("should reject name too long", () => {
			const longName = "a".repeat(51);
			const data = {
				name: longName,
				description: "Test",
			};
			const result = createChannelSchema.safeParse(data);

			expect(result.success).toBe(false);
		});

		it("should accept channel without description", () => {
			const data = {
				name: "general",
			};
			const result = createChannelSchema.safeParse(data);

			expect(result.success).toBe(true);
		});

		it("should accept name with minimum length (3)", () => {
			const data = {
				name: "abc",
				description: "Test",
			};
			const result = createChannelSchema.safeParse(data);

			expect(result.success).toBe(true);
		});

		it("should accept name with maximum length (50)", () => {
			const data = {
				name: "a".repeat(50),
				description: "Test",
			};
			const result = createChannelSchema.safeParse(data);

			expect(result.success).toBe(true);
		});
	});

	describe("updateChannelSchema", () => {
		it("should accept valid update data", () => {
			const data = {
				name: "new-name",
				description: "New description",
			};
			const result = updateChannelSchema.safeParse(data);

			expect(result.success).toBe(true);
		});

		it("should accept partial update (name only)", () => {
			const data = {
				name: "new-name",
			};
			const result = updateChannelSchema.safeParse(data);

			expect(result.success).toBe(true);
		});

		it("should accept partial update (description only)", () => {
			const data = {
				description: "New description",
			};
			const result = updateChannelSchema.safeParse(data);

			expect(result.success).toBe(true);
		});

		it("should accept empty object (no updates)", () => {
			const data = {};
			const result = updateChannelSchema.safeParse(data);

			expect(result.success).toBe(true);
		});
	});
});
