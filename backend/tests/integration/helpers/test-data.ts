// backend/tests/integration/helpers/test-data.ts
import { randomUUID } from "crypto";

/**
 * Genera nombre único para channel que cumple con regex [a-z0-9-]+
 */
export function uniqueChannelName(): string {
	return `test-ch-${randomUUID().slice(0, 8).toLowerCase()}`;
}

/**
 * Genera username único que cumple con validaciones
 */
export function uniqueUsername(): string {
	return `test-user-${randomUUID().slice(0, 8).toLowerCase()}`;
}

/**
 * Genera email único válido
 */
export function uniqueEmail(): string {
	return `test-${randomUUID().slice(0, 8).toLowerCase()}@example.com`;
}

/**
 * Genera contenido único para mensajes
 */
export function uniqueMessageContent(): string {
	return `Test message ${Date.now()}`;
}

/**
 * Genera datos completos para test user
 */
export function generateTestUser() {
	const id = randomUUID().slice(0, 8).toLowerCase();
	return {
		workos_id: `user_test_${id}`,
		email: `test-${id}@example.com`,
		username: `testuser-${id}`,
		display_name: `Test User ${id}`,
	};
}

/**
 * Crea un test user (alias de generateTestUser)
 */
export function createTestUser() {
	return generateTestUser();
}

/**
 * Genera datos para test channel
 */
export function createTestChannel(createdBy?: string) {
	const id = randomUUID().slice(0, 8).toLowerCase();
	return {
		name: `test-ch-${id}`,
		description: `Test channel ${id}`,
		created_by: createdBy || "system",
	};
}
