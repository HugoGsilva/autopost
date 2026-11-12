import { openAsBlob } from "node:fs";
import { open } from "node:fs/promises";

export class ProviderError extends Error {
	constructor(
		message: string,
		readonly status?: number,
		readonly retryable = false,
		readonly body?: unknown,
	) {
		super(message);
		this.name = "ProviderError";
	}
}

type RequestOptions = Omit<RequestInit, "body"> & {
	query?: Record<string, string | number | boolean | undefined>;
	json?: unknown;
	form?: Record<string, string | undefined>;
	body?: BodyInit;
	bearer?: string;
	/** Extrai mensagem de erro específica da plataforma. */
	errorMessage?: (body: unknown) => string | undefined;
	/** Recusa respostas maiores que isso (servidores escolhidos pelo usuário). */
	maxResponseBytes?: number;
};

export function withQuery(
	url: string,
	query?: RequestOptions["query"],
): string {
	if (!query) return url;
	const u = new URL(url);
	for (const [k, v] of Object.entries(query))
		if (v !== undefined) u.searchParams.set(k, String(v));
	return u.toString();
}

function defaultErrorMessage(body: unknown): string | undefined {
	if (!body || typeof body !== "object")
		return typeof body === "string" && body ? body.slice(0, 300) : undefined;
	const b = body as Record<string, any>;
	return (
		b.error?.message ??
		b.error_description ??
		(typeof b.error === "string" ? b.error : undefined) ??
		b.message ??
		b.detail ??
		b.errors?.[0]?.message ??
		b.title
	);
}

async function readText(res: Response, max?: number): Promise<string> {
	if (!max || !res.body) return res.text();
	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > max) {
			await reader.cancel();
			throw new ProviderError("Resposta grande demais do servidor");
		}
		chunks.push(value);
	}
	return Buffer.concat(chunks).toString("utf8");
}

/** fetch com JSON/form, erro padronizado e classificação de retry (429/5xx). */
export async function request<T = any>(
	url: string,
	opts: RequestOptions = {},
): Promise<{ data: T; res: Response }> {
	const {
		query,
		json,
		form,
		bearer,
		errorMessage,
		maxResponseBytes,
		headers,
		body,
		...init
	} = opts;
	const h = new Headers(headers);
	let payload: BodyInit | undefined = body;
	if (json !== undefined) {
		h.set("Content-Type", "application/json");
		payload = JSON.stringify(json);
	} else if (form) {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(form))
			if (v !== undefined) params.set(k, v);
		h.set("Content-Type", "application/x-www-form-urlencoded");
		payload = params;
	}
	if (bearer) h.set("Authorization", `Bearer ${bearer}`);

	let res: Response;
	try {
		res = await fetch(withQuery(url, query), {
			...init,
			headers: h,
			body: payload,
		});
	} catch (err) {
		throw new ProviderError(
			`Falha de rede: ${(err as Error).message}`,
			undefined,
			true,
		);
	}
	const text = await readText(res, maxResponseBytes);
	let data: any = text;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {}
	if (!res.ok) {
		const msg =
			errorMessage?.(data) ?? defaultErrorMessage(data) ?? res.statusText;
		throw new ProviderError(
			`${res.status}: ${msg}`,
			res.status,
			res.status === 429 || res.status >= 500,
			data,
		);
	}
	return { data: data as T, res };
}

export async function fileBlob(path: string, type: string): Promise<Blob> {
	return openAsBlob(path, { type });
}

/** Lê [start, end) do arquivo. */
export async function readChunk(
	path: string,
	start: number,
	end: number,
): Promise<Uint8Array<ArrayBuffer>> {
	const fh = await open(path, "r");
	try {
		const buf = new Uint8Array(end - start);
		await fh.read(buf, 0, end - start, start);
		return buf;
	} finally {
		await fh.close();
	}
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Repete `check` até retornar valor ≠ undefined ou estourar o tempo. */
export async function poll<T>(
	check: () => Promise<T | undefined>,
	{ intervalMs = 5000, timeoutMs = 10 * 60_000, what = "processamento" } = {},
): Promise<T> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const v = await check();
		if (v !== undefined) return v;
		await sleep(intervalMs);
	}
	throw new ProviderError(`Tempo esgotado aguardando ${what}`, undefined, true);
}

export function truncate(text: string, max: number): string {
	const chars = Array.from(text);
	return chars.length <= max ? text : `${chars.slice(0, max - 1).join("")}…`;
}

export function firstLine(text: string, fallback: string): string {
	return (
		text
			.split("\n")
			.map((l) => l.trim())
			.find(Boolean) ?? fallback
	);
}

export function basicAuth(id: string, secret: string): string {
	return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export function secondsFromNow(sec?: number | null): Date | null {
	return sec ? new Date(Date.now() + sec * 1000) : null;
}
