import {
	ProviderError,
	poll,
	readChunk,
	request,
	secondsFromNow,
	truncate,
	withQuery,
} from "../http";
import { MOV, MP4, type Provider, WEBM } from "../types";

const API = "https://open.tiktokapis.com/v2";
const MB = 1024 * 1024;

const tiktokError = (body: any) =>
	body?.error && body.error.code !== "ok"
		? `${body.error.code}: ${body.error.message}`
		: undefined;

/** Regras do FILE_UPLOAD: chunks de 5–64MB; o último pode ir até 128MB; <64MB vai inteiro. */
export function tiktokChunks(size: number) {
	if (size <= 64 * MB) return { chunkSize: size, count: 1 };
	const chunkSize = 10 * MB;
	return { chunkSize, count: Math.floor(size / chunkSize) };
}

async function api(path: string, token: string, json?: unknown) {
	const { data } = await request(`${API}${path}`, {
		method: "POST",
		bearer: token,
		headers: { "Content-Type": "application/json; charset=UTF-8" },
		body: JSON.stringify(json ?? {}),
		errorMessage: tiktokError,
	});
	const err = tiktokError(data);
	if (err) throw new ProviderError(err, undefined, false, data);
	return data.data;
}

export const tiktok: Provider = {
	id: "tiktok",
	name: "TikTok",
	brandColor: "#000000",
	auth: "oauth",
	tagline: "Publicação direta ou envio para a caixa de rascunhos",
	requirements:
		"Enquanto o app não for auditado pelo TikTok, a conta precisa estar privada e os vídeos saem como “Só eu”.",
	captionLimit: 2200,
	acceptedTypes: [MP4, MOV, WEBM],
	preferredAspect: "vertical",
	maxSizeMB: 4096,
	maxDurationSec: 10 * 60,
	optionFields: [
		{
			key: "mode",
			label: "Modo",
			kind: "select",
			choices: [
				{ value: "direct", label: "Publicar direto" },
				{ value: "inbox", label: "Enviar como rascunho (finalizar no app)" },
			],
		},
		{
			key: "privacy",
			label: "Quem pode ver",
			kind: "select",
			choices: [
				{ value: "PUBLIC_TO_EVERYONE", label: "Todos" },
				{ value: "MUTUAL_FOLLOW_FRIENDS", label: "Amigos" },
				{ value: "FOLLOWER_OF_CREATOR", label: "Seguidores" },
				{ value: "SELF_ONLY", label: "Só eu" },
			],
		},
	],
	setup: {
		consoleUrl: "https://developers.tiktok.com/apps/",
		clientIdLabel: "Client Key",
		clientSecretLabel: "Client Secret",
		scopes: ["user.info.basic", "video.publish", "video.upload"],
		steps: [
			"Em developers.tiktok.com crie um app e adicione os produtos “Login Kit” e “Content Posting API” (ative “Direct Post”).",
			"Em Login Kit, cole a URL de retorno abaixo em “Redirect URI”.",
			"Copie o Client Key e o Client Secret.",
			"Sem auditoria do TikTok, os vídeos saem como PRIVADOS (Só eu) e a conta precisa estar privada. Envie o app para auditoria para publicar em público.",
		],
	},
	warning:
		"Antes da auditoria do app no TikTok, os posts ficam visíveis só para você.",
	refreshWindowMs: 10 * 60_000,

	getAuthUrl: (ctx) =>
		withQuery("https://www.tiktok.com/v2/auth/authorize/", {
			client_key: ctx.clientId,
			scope: tiktok.setup!.scopes.join(","),
			response_type: "code",
			redirect_uri: ctx.redirectUri,
			state: ctx.state,
		}),

	async exchangeCode(ctx) {
		const { data: token } = await request(`${API}/oauth/token/`, {
			method: "POST",
			form: {
				client_key: ctx.clientId,
				client_secret: ctx.clientSecret,
				code: ctx.code,
				grant_type: "authorization_code",
				redirect_uri: ctx.redirectUri,
			},
		});
		if (token.error)
			throw new ProviderError(`${token.error}: ${token.error_description}`);
		const { data } = await request(`${API}/user/info/`, {
			query: { fields: "open_id,avatar_url,display_name" },
			bearer: token.access_token,
		});
		const user = data.data.user;
		return [
			{
				externalId: token.open_id ?? user.open_id,
				name: user.display_name,
				avatarUrl: user.avatar_url ?? null,
				credentials: {
					accessToken: token.access_token,
					refreshToken: token.refresh_token,
				},
				expiresAt: secondsFromNow(token.expires_in),
			},
		];
	},

	async refresh(account, app) {
		if (!app || !account.credentials.refreshToken) return null;
		const { data } = await request(`${API}/oauth/token/`, {
			method: "POST",
			form: {
				client_key: app.clientId,
				client_secret: app.clientSecret,
				grant_type: "refresh_token",
				refresh_token: account.credentials.refreshToken,
			},
		});
		if (data.error)
			throw new ProviderError(`${data.error}: ${data.error_description}`);
		return {
			credentials: {
				accessToken: data.access_token,
				refreshToken: data.refresh_token,
			},
			expiresAt: secondsFromNow(data.expires_in),
		};
	},

	async publish({ account, media, caption, options, log }) {
		const token = account.credentials.accessToken!;
		const { chunkSize, count } = tiktokChunks(media.size);
		const source_info = {
			source: "FILE_UPLOAD",
			video_size: media.size,
			chunk_size: chunkSize,
			total_chunk_count: count,
		};
		const inbox = options.mode === "inbox";

		let init: { publish_id: string; upload_url: string };
		let note: string | undefined;
		if (inbox) {
			init = await api("/post/publish/inbox/video/init/", token, {
				source_info,
			});
		} else {
			const creator = await api("/post/publish/creator_info/query/", token);
			const allowed: string[] = creator.privacy_level_options ?? [];
			const wanted = String(options.privacy || "PUBLIC_TO_EVERYONE");
			const privacy = allowed.includes(wanted)
				? wanted
				: allowed.includes("SELF_ONLY")
					? "SELF_ONLY"
					: allowed[0];
			if (privacy !== wanted) {
				log(`Privacidade "${wanted}" indisponível — usando "${privacy}"`);
				note =
					privacy === "SELF_ONLY"
						? "Publicado como “Só eu”: o TikTok ainda não liberou posts públicos para este app (falta a auditoria)."
						: `O TikTok não permitiu “${wanted}”; publicado como “${privacy}”.`;
			}
			init = await api("/post/publish/video/init/", token, {
				post_info: {
					title: truncate(caption, 2200),
					privacy_level: privacy,
					video_cover_timestamp_ms: 1000,
				},
				source_info,
			});
		}
		log(`publish_id ${init.publish_id}`);

		for (let i = 0; i < count; i++) {
			const start = i * chunkSize;
			const end = i === count - 1 ? media.size : start + chunkSize;
			await request(init.upload_url, {
				method: "PUT",
				headers: {
					"Content-Type": media.mimeType,
					"Content-Range": `bytes ${start}-${end - 1}/${media.size}`,
				},
				body: await readChunk(media.path, start, end),
			});
		}
		log(`Upload concluído (${count} parte(s))`);

		const status = await poll(
			async () => {
				const s = await api("/post/publish/status/fetch/", token, {
					publish_id: init.publish_id,
				});
				if (s.status === "FAILED")
					throw new ProviderError(`TikTok falhou: ${s.fail_reason}`);
				if (
					s.status === "PUBLISH_COMPLETE" ||
					s.status === "SEND_TO_USER_INBOX"
				)
					return s;
				return undefined;
			},
			{ what: "processamento do TikTok" },
		);
		const postId = status.publicaly_available_post_id?.[0];
		if (inbox)
			note =
				"Enviado para a caixa de rascunhos do TikTok: abra o app em até 24h para publicar.";
		return {
			note,
			externalId: String(postId ?? init.publish_id),
			url: postId
				? `https://www.tiktok.com/@${account.username ?? "_"}/video/${postId}`
				: null,
		};
	},
};
