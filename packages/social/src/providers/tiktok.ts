import {
	ProviderError,
	poll,
	readChunk,
	request,
	secondsFromNow,
	truncate,
	withQuery,
} from "../http";
import {
	type TikTokCreatorInfo,
	tiktokPostOptions,
	tiktokPostProblems,
} from "../tiktok-rules";
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

/** Dados do criador que o TikTok exige consultar antes de mostrar a tela de post. */
export async function tiktokCreatorInfo(
	token: string,
): Promise<TikTokCreatorInfo> {
	const c = await api("/post/publish/creator_info/query/", token);
	return {
		nickname: c.creator_nickname ?? "",
		username: c.creator_username ?? null,
		avatarUrl: c.creator_avatar_url ?? null,
		privacyOptions: c.privacy_level_options ?? [],
		commentDisabled: Boolean(c.comment_disabled),
		duetDisabled: Boolean(c.duet_disabled),
		stitchDisabled: Boolean(c.stitch_disabled),
		maxDurationSec: c.max_video_post_duration_sec ?? null,
	};
}

export const tiktok: Provider = {
	id: "tiktok",
	name: "TikTok",
	brandColor: "#000000",
	auth: "oauth",
	tagline: "Publicação direta ou envio para a caixa de rascunhos",
	captionLimit: 2200,
	acceptedTypes: [MP4, MOV, WEBM],
	preferredAspect: "vertical",
	maxSizeMB: 4096,
	maxDurationSec: 10 * 60,
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
			// Consulta de novo na hora: a conta pode ter mudado desde o agendamento.
			const creator = await tiktokCreatorInfo(token);
			const problems = tiktokPostProblems(options, creator, media.durationSec);
			if (problems.length) throw new ProviderError(problems.join(" • "));
			const o = tiktokPostOptions(options);
			log(`Privacidade ${o.privacy}`);
			init = await api("/post/publish/video/init/", token, {
				post_info: {
					title: truncate(caption, 2200),
					privacy_level: o.privacy,
					disable_comment: !o.allowComment || creator.commentDisabled,
					disable_duet: !o.allowDuet || creator.duetDisabled,
					disable_stitch: !o.allowStitch || creator.stitchDisabled,
					brand_organic_toggle: o.brandOrganic,
					brand_content_toggle: o.brandContent,
					video_cover_timestamp_ms: 1000,
				},
				source_info,
			});
			if (o.privacy === "SELF_ONLY")
				note = "Publicado como “Só eu”: só você vê o vídeo no TikTok.";
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
				"Enviado para a caixa de rascunhos do TikTok: abra a notificação no app em até 24h para revisar e publicar.";
		else if (!postId)
			note ??=
				"O TikTok recebeu o vídeo. Ele pode levar alguns minutos para aparecer no perfil.";
		return {
			note,
			externalId: String(postId ?? init.publish_id),
			url: postId
				? `https://www.tiktok.com/@${account.username ?? "_"}/video/${postId}`
				: null,
		};
	},
};
