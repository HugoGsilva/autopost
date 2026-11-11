import type { AppRouterClient } from "@autopost/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import {
	environmentManager,
	QueryCache,
	QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

export function createQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => {
				// Sessão expirou (ou acesso removido): volta para o login em vez de mostrar erro.
				if (
					(error as { code?: string }).code === "UNAUTHORIZED" &&
					typeof window !== "undefined"
				) {
					window.location.href = "/login";
					return;
				}
				toast.error(error.message, {
					action: {
						label: "Tentar de novo",
						onClick: () => {
							query.invalidate();
						},
					},
				});
			},
		}),
	});
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
	if (environmentManager.isServer()) {
		return createQueryClient();
	}

	browserQueryClient ??= createQueryClient();
	return browserQueryClient;
}

export const link = new RPCLink({
	plugins: [new SimpleCsrfProtectionLinkPlugin()],
	url: `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3001"}/api/rpc`,
	fetch(url, options) {
		return fetch(url, {
			...options,
			credentials: "include",
		});
	},
	headers: async () => {
		if (typeof window !== "undefined") {
			return {};
		}

		const { headers } = await import("next/headers");
		return Object.fromEntries(await headers());
	},
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
