import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkOS } from "@workos-inc/node";
import type { Queue } from "bullmq";
import "fastify";
import type { Redis } from "ioredis";

declare module "fastify" {
	export interface FastifyRequest {
		user?: {
			id: string;
			email: string;
			firstName: string;
			lastName: string;
		};
	}

	export interface FastifyInstance {
		workos: WorkOS;
		authenticate: (
			request: FastifyRequest,
			reply: FastifyReply
		) => Promise<void>;

		supabase: SupabaseClient;
		redis: Redis;

		queues: {
			notifications: Queue;
			analytics: Queue;
			cleanup: Queue;
		};

		addJob: (
			queueName: "notifications" | "analytics" | "cleanup",
			jobName: string,
			data: any,
			options?: any
		) => Promise<any>;
	}
}
