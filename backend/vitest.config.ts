import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		exclude: [...configDefaults.exclude, "dist/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/",
				"dist/",
				"tests/",
				"**/*.d.ts",
				"**/*.config.ts",
			],
			thresholds: {
				lines: 80, // 80% de líneas ejecutadas
				functions: 80, // 80% de funciones llamadas
				branches: 75, // 75% de if/else ejecutados
				statements: 80, // 80% de statements ejecutados
			},
		},
	},
});
