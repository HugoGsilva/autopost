import { appRouter } from "@autopost/api/routers/index";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { NextRequest } from "next/server";

import { createContext } from "../../../../context";

const isDev = process.env.NODE_ENV !== "production";

const logError = (error: unknown) => {
	console.error(error);
};

// CSRF: o cliente oficial manda um header que um formulário de outro site não consegue mandar.
const rpcHandler = new RPCHandler(appRouter, {
	plugins: [new SimpleCsrfProtectionHandlerPlugin()],
	interceptors: [onError(logError)],
});

// Referência da API (Scalar) só em desenvolvimento.
const apiHandler = isDev
	? new OpenAPIHandler(appRouter, {
			plugins: [
				new SimpleCsrfProtectionHandlerPlugin(),
				new OpenAPIReferencePlugin({
					schemaConverters: [new ZodToJsonSchemaConverter()],
				}),
			],
			interceptors: [onError(logError)],
		})
	: null;

async function handleRequest(req: NextRequest) {
	const context = await createContext(req);
	const rpcResult = await rpcHandler.handle(req, {
		prefix: "/api/rpc",
		context,
	});
	if (rpcResult.response) return rpcResult.response;

	if (apiHandler) {
		const apiResult = await apiHandler.handle(req, {
			prefix: "/api/rpc/api-reference",
			context,
		});
		if (apiResult.response) return apiResult.response;
	}

	return new Response("Not found", { status: 404 });
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
