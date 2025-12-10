import { createClient } from "@supabase/supabase-js";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

export const databasePlugin = fp(async (fastify: FastifyInstance) => {
	const supabase = createClient(
		process.env.SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!
	);

	fastify.decorate("supabase", supabase);

	// Test connection
	const { error } = await supabase.from("users").select("count").limit(1);
	if (error && !error.message.includes("does not exist")) {
		fastify.log.error("Database connection failed:", undefined, error.message);
	} else {
		fastify.log.info("✅ Database connected");
	}
});
