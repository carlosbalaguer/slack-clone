import type { FastifyRequest, FastifyReply } from "fastify";

type APIVersionStatus = "current" | "deprecated" | "sunset";

/**
 * Configuración de versiones de API
 */
export const API_VERSIONS = {
	v1: {
		version: "v1",
		status: "current" as APIVersionStatus,
		deprecationDate: null,
		sunsetDate: null,
		successorVersion: null,
	},
	// v2: {
	//   version: "v2",
	//   status: "current",
	//   deprecationDate: null,
	//   sunsetDate: null,
	//   successorVersion: null,
	// }
} as const;

/**
 * Añade headers de versión a todas las respuestas
 */
export function addVersionHeaders(version: keyof typeof API_VERSIONS) {
	return async (request: FastifyRequest, reply: FastifyReply) => {
		const versionConfig = API_VERSIONS[version];

		// Header con versión actual
		reply.header("X-API-Version", versionConfig.version);

		// Si está deprecated, añadir headers de deprecation
		if (versionConfig.status === "deprecated") {
			reply.header(
				"X-API-Deprecation",
				"This API version is deprecated"
			);

			if (versionConfig.deprecationDate) {
				reply.header(
					"X-API-Deprecation-Date",
					versionConfig.deprecationDate
				);
			}

			if (versionConfig.sunsetDate) {
				reply.header("X-API-Sunset-Date", versionConfig.sunsetDate);
			}

			if (versionConfig.successorVersion) {
				reply.header(
					"Link",
					`</api/${versionConfig.successorVersion}${request.url.replace(`/api/${version}`, "")}>; rel="successor-version"`
				);
			}
		}

		// Si está sunset (ya no se debe usar)
		if (versionConfig.status === "sunset") {
			reply.header("X-API-Status", "sunset");
			reply.header(
				"X-API-Sunset",
				"This API version is no longer supported"
			);

			if (versionConfig.successorVersion) {
				reply.header(
					"Link",
					`</api/${versionConfig.successorVersion}${request.url.replace(`/api/${version}`, "")}>; rel="successor-version"`
				);
			}
		}
	};
}

/**
 * Extrae versión del request (por si usas header-based versioning)
 */
export function getRequestedVersion(
	request: FastifyRequest
): keyof typeof API_VERSIONS {
	// Prioridad 1: Header API-Version
	const headerVersion = request.headers["api-version"] as string;
	if (headerVersion && headerVersion in API_VERSIONS) {
		return headerVersion as keyof typeof API_VERSIONS;
	}

	// Prioridad 2: URL (ya manejado por prefix)
	// Prioridad 3: Query param (fallback)
	const queryVersion = (request.query as any).version;
	if (queryVersion && queryVersion in API_VERSIONS) {
		return queryVersion as keyof typeof API_VERSIONS;
	}

	// Default: v1
	return "v1";
}