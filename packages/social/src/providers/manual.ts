import { randomToken } from "../crypto";
import { fileBlob, ProviderError, request, sleep, truncate } from "../http";
import { assertPublicHttpsUrl } from "../safe-url";
import { MOV, MP4, type Provider, WEBM } from "../types";

/* ───────────────────────── Bluesky (senha de app) ───────────────────────── */

/** Teto de espera do Demo: o valor vem do usuário e o worker não pode ficar preso nele. */
const demoDelay = (v: unknown) => Math.min(Math.max(Number(v) || 1500, 0), 10_000);

const BSKY = "https://bsky.social";

/** Só a mensagem do padrão XRPC: nunca devolve o corpo cru de um servidor qualquer. */
const xrpcError = (body: unknown) =>
	body && typeof body === "object" && typeof (body as any).message === "string"
		? String((body as any).message).slice(0, 300)
		: "resposta inesperada do servidor";

/**
 * Chamada ao servidor do Bluesky. O servidor pode ser digitado pelo usuário, então
 * (anti-SSRF) é revalidado a cada chamada e redirecionamentos nunca são seguidos.
 */
async function xrpc(
	service: string,
	method: string,
	opts: Parameters<typeof request>[1] = {},
) {
	if (service !== BSKY) await assertPublicHttpsUrl(service);
	// Tempo e tamanho limitados: um servidor lento ou gigante não pode prender o worker.
	const upload = method === "com.atproto.repo.uploadBlob";
	return request(`${service}/xrpc/${method}`, {
		...opts,
		redirect: "manual",
		signal: AbortSignal.timeout(upload ? 15 * 60_000 : 60_000),
		maxResponseBytes: 1024 * 1024,
		errorMessage: xrpcError,
	});
}

async function bskySession(c: Record<string, unknown>) {
	const raw = String(c.service || BSKY).trim();
	const service = raw === BSKY ? raw : (await assertPublicHttpsUrl(raw)).origin;
	const { data } = await xrpc(service, "com.atproto.server.createSession", {
		method: "POST",
		json: { identifier: c.identifier, password: c.password },
	});
	return {
		service,
		...(data as { accessJwt: string; did: string; handle: string }),
	};
}

/** Links e #hashtags viram "facets" (offsets em bytes UTF-8). */
export function bskyFacets(text: string) {
	const enc = new TextEncoder();
	const facets: unknown[] = [];
	const add = (re: RegExp, feature: (m: string) => unknown) => {
		for (const m of text.matchAll(re)) {
			const value = m[2] ?? m[0];
			const startChar = (m.index ?? 0) + m[0].length - value.length;
			const byteStart = enc.encode(text.slice(0, startChar)).length;
			facets.push({
				index: { byteStart, byteEnd: byteStart + enc.encode(value).length },
				features: [feature(value)],
			});
		}
	};
	add(/(^|\s)(https?:\/\/[^\s]+)/g, (v) => ({
		$type: "app.bsky.richtext.facet#link",
		uri: v,
	}));
	add(/(^|\s)(#[^\s#.,!?;:]+)/g, (v) => ({
		$type: "app.bsky.richtext.facet#tag",
		tag: v.slice(1),
	}));
	return facets;
}

export const bluesky: Provider = {
	id: "bluesky",
	name: "Bluesky",
	brandColor: "#1185FE",
	auth: "manual",
	tagline: "Posts com vídeo no Bluesky",
	requirements: "Use uma “senha de app” (não a sua senha normal).",
	captionLimit: 300,
	acceptedTypes: [MP4, MOV, WEBM],
	maxSizeMB: 100,
	maxDurationSec: 180,
	manualFields: [
		{ key: "identifier", label: "Usuário", placeholder: "empresa.bsky.social" },
		{
			key: "password",
			label: "Senha de app",
			type: "password",
			placeholder: "xxxx-xxxx-xxxx-xxxx",
			help: "Crie em bsky.app → Configurações → Privacidade e segurança → Senhas de app.",
		},
		{
			key: "service",
			label: "Servidor (avançado: deixe em branco)",
			type: "url",
			placeholder: "https://bsky.social",
			optional: true,
		},
	],

	async connectManual(f) {
		const s = await bskySession(f);
		const { data: profile } = await xrpc(s.service, "app.bsky.actor.getProfile", {
			query: { actor: s.did },
			bearer: s.accessJwt,
		});
		return {
			externalId: s.did,
			name: profile.displayName || s.handle,
			username: s.handle,
			avatarUrl: profile.avatar ?? null,
			credentials: {
				identifier: f.identifier,
				password: f.password,
				service: s.service,
			},
		};
	},

	async publish({ account, media, caption }) {
		const s = await bskySession(account.credentials);
		const { data: blob } = await xrpc(
			s.service,
			"com.atproto.repo.uploadBlob",
			{
				method: "POST",
				bearer: s.accessJwt,
				headers: { "Content-Type": media.mimeType },
				body: await fileBlob(media.path, media.mimeType),
			},
		);
		const text = truncate(caption, 300);
		const embed: Record<string, unknown> = {
			$type: "app.bsky.embed.video",
			video: blob.blob,
		};
		if (media.width && media.height)
			embed.aspectRatio = { width: media.width, height: media.height };
		const { data } = await xrpc(
			s.service,
			"com.atproto.repo.createRecord",
			{
				method: "POST",
				bearer: s.accessJwt,
				json: {
					repo: s.did,
					collection: "app.bsky.feed.post",
					record: {
						$type: "app.bsky.feed.post",
						text,
						facets: bskyFacets(text),
						createdAt: new Date().toISOString(),
						langs: ["pt"],
						embed,
					},
				},
			},
		);
		const rkey = String(data.uri).split("/").pop();
		return {
			externalId: data.uri,
			url: `https://bsky.app/profile/${s.handle}/post/${rkey}`,
		};
	},
};

/* ───────────────────────── Telegram (bot + canal) ───────────────────────── */

const tgError = (b: any) => (b?.ok === false ? b.description : undefined);

export const telegram: Provider = {
	id: "telegram",
	name: "Telegram",
	brandColor: "#26A5E4",
	auth: "manual",
	tagline: "Envia para um canal ou grupo do Telegram",
	requirements: "O bot precisa ser administrador do canal.",
	captionLimit: 1024,
	acceptedTypes: [MP4],
	maxSizeMB: 50,
	manualFields: [
		{
			key: "botToken",
			label: "Token do bot",
			type: "password",
			placeholder: "123456:ABC-DEF...",
			help: "Crie um bot com o @BotFather e adicione-o como administrador do canal.",
		},
		{
			key: "chatId",
			label: "Canal ou grupo",
			placeholder: "@meucanal ou -100123456789",
		},
	],

	async connectManual(f) {
		if (!/^\d+:[\w-]+$/.test(f.botToken ?? ""))
			throw new ProviderError("Token do bot inválido (formato 123456:ABC...)");
		const base = `https://api.telegram.org/bot${f.botToken}`;
		await request(`${base}/getMe`, { errorMessage: tgError });
		const { data } = await request(`${base}/getChat`, {
			query: { chat_id: f.chatId },
			errorMessage: tgError,
		});
		const chat = data.result;
		return {
			externalId: String(chat.id),
			name: chat.title ?? chat.username ?? String(chat.id),
			username: chat.username ?? null,
			credentials: { botToken: f.botToken },
		};
	},

	async publish({ account, media, caption }) {
		const form = new FormData();
		form.set("chat_id", account.externalId);
		form.set("caption", truncate(caption, 1024));
		form.set("supports_streaming", "true");
		form.set(
			"video",
			await fileBlob(media.path, media.mimeType),
			media.fileName,
		);
		const { data } = await request(
			`https://api.telegram.org/bot${account.credentials.botToken}/sendVideo`,
			{
				method: "POST",
				body: form,
				errorMessage: tgError,
			},
		);
		const id = String(data.result.message_id);
		return {
			externalId: id,
			url: account.username ? `https://t.me/${account.username}/${id}` : null,
		};
	},
};

/* ───────────────────────── Discord (webhook) ───────────────────────── */

export const discord: Provider = {
	id: "discord",
	name: "Discord",
	brandColor: "#5865F2",
	auth: "manual",
	tagline: "Posta num canal do Discord",
	requirements: "Peça o link do webhook a quem administra o servidor.",
	captionLimit: 2000,
	acceptedTypes: [MP4, MOV, WEBM],
	maxSizeMB: 20,
	manualFields: [
		{
			key: "webhookUrl",
			label: "URL do webhook",
			type: "url",
			placeholder: "https://discord.com/api/webhooks/...",
			help: "No canal: Editar canal → Integrações → Webhooks → Novo webhook → Copiar URL.",
		},
	],

	async connectManual(f) {
		if (
			!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(
				f.webhookUrl ?? "",
			)
		)
			throw new ProviderError("URL de webhook do Discord inválida");
		const { data } = await request(f.webhookUrl!);
		return {
			externalId: String(data.id),
			name: data.name ?? "Webhook",
			username: data.channel_id ? `#${data.channel_id}` : null,
			avatarUrl: data.avatar
				? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
				: null,
			credentials: { webhookUrl: f.webhookUrl },
			meta: { guildId: data.guild_id, channelId: data.channel_id },
		};
	},

	async publish({ account, media, caption }) {
		const form = new FormData();
		form.set(
			"payload_json",
			JSON.stringify({ content: truncate(caption, 2000) }),
		);
		form.set(
			"files[0]",
			await fileBlob(media.path, media.mimeType),
			media.fileName,
		);
		const { data } = await request(
			`${account.credentials.webhookUrl}?wait=true`,
			{ method: "POST", body: form },
		);
		const { guildId, channelId } = account.meta as {
			guildId?: string;
			channelId?: string;
		};
		return {
			externalId: String(data.id),
			url:
				guildId && channelId
					? `https://discord.com/channels/${guildId}/${channelId}/${data.id}`
					: null,
		};
	},
};

/* ───────────────────────── Demo (simulação) ───────────────────────── */

export const demo: Provider = {
	id: "demo",
	name: "Demo",
	brandColor: "#D4A82E",
	auth: "manual",
	tagline: "Rede de teste: simula uma publicação, sem postar de verdade",
	captionLimit: 5000,
	acceptedTypes: [MP4, MOV, WEBM],
	manualFields: [
		{ key: "name", label: "Nome da conta", placeholder: "Conta de teste" },
		{
			key: "delayMs",
			label: "Tempo simulado (ms)",
			placeholder: "1500",
			optional: true,
			help: "Escreva #falha na legenda para simular um erro de publicação.",
		},
	],

	async connectManual(f) {
		const name = f.name?.trim() || "Conta de teste";
		return {
			externalId: `demo-${randomToken(6)}`,
			name,
			username: name.toLowerCase().replace(/\s+/g, "."),
			credentials: { delayMs: demoDelay(f.delayMs) },
		};
	},

	async publish({ account, caption, log }) {
		await sleep(demoDelay(account.credentials.delayMs));
		if (/#falha\b/i.test(caption))
			throw new ProviderError("Falha simulada (#falha na legenda)");
		log("Publicação simulada");
		return { externalId: `demo-post-${randomToken(6)}`, url: null };
	},
};
