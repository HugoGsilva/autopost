import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { MediaForPublish, PublishInput } from "./types";

export type Call = {
	method: string;
	url: string;
	headers: Headers;
	body: unknown;
};
type Handler = (call: Call) => unknown | Response;

/** Substitui o fetch global por rotas "METHOD url-prefix" → resposta JSON. Registra as chamadas. */
export function mockFetch(routes: [string, Handler][]) {
	const calls: Call[] = [];
	const original = globalThis.fetch;
	globalThis.fetch = (async (
		input: string | URL | Request,
		init?: RequestInit,
	) => {
		const url = String(input instanceof Request ? input.url : input);
		const method = (init?.method ?? "GET").toUpperCase();
		const headers = new Headers(init?.headers);
		let body: unknown = init?.body;
		if (typeof body === "string") {
			try {
				body = JSON.parse(body);
			} catch {}
		} else if (body instanceof URLSearchParams) body = Object.fromEntries(body);
		const call = { method, url, headers, body };
		calls.push(call);
		const route = routes.find(([key]) => {
			const [m, prefix] = key.split(" ");
			return m === method && url.startsWith(prefix!);
		});
		if (!route)
			return new Response(
				JSON.stringify({
					error: { message: `sem rota mock: ${method} ${url}` },
				}),
				{ status: 404 },
			);
		const out = route[1](call);
		if (out instanceof Response) return out;
		return new Response(JSON.stringify(out ?? {}), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}) as typeof fetch;
	return { calls, restore: () => (globalThis.fetch = original) };
}

export function tempVideo(size = 2048): MediaForPublish {
	const dir = mkdtempSync(path.join(tmpdir(), "autopost-test-"));
	const file = path.join(dir, "video.mp4");
	writeFileSync(file, Buffer.alloc(size, 1));
	return {
		path: file,
		size,
		mimeType: "video/mp4",
		fileName: "video.mp4",
		publicUrl: "https://cast.example.com/api/media/x/y/video.mp4",
		durationSec: 12,
		width: 1080,
		height: 1920,
	};
}

export function publishInput(
	partial: Partial<PublishInput> & { media: MediaForPublish },
): PublishInput {
	return {
		account: {
			externalId: "acc-1",
			name: "Conta",
			username: "conta",
			credentials: { accessToken: "tok" },
			meta: {},
		},
		caption: "Olá #teste https://ia2s.com.br",
		options: {},
		app: { clientId: "cid", clientSecret: "csecret" },
		log: () => {},
		...partial,
	};
}
