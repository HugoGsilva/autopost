import {
	basicAuth,
	ProviderError,
	poll,
	readChunk,
	request,
	secondsFromNow,
	sleep,
	withQuery,
} from "../http";
import { type AppCredentials, MOV, MP4, type Provider } from "../types";

const API = "https://api.x.com/2";
const CHUNK = 4 * 1024 * 1024;

async function token(app: AppCredentials, form: Record<string, string>) {
	const { data } = await request(`${API}/oauth2/token`, {
		method: "POST",
		headers: { Authorization: basicAuth(app.clientId, app.clientSecret) },
		form: { ...form, client_id: app.clientId },
	});
	return data;
}

export const x: Provider = {
	id: "x",
	name: "X (Twitter)",
	brandColor: "#000000",
	auth: "oauth",
	tagline: "Post com vídeo no X",
	requirements: "Exige plano pago da API do X configurado pelo administrador.",
	captionLimit: 280,
	acceptedTypes: [MP4, MOV],
	maxSizeMB: 512,
	maxDurationSec: 140,
	setup: {
		consoleUrl: "https://developer.x.com/en/portal/dashboard",
		clientIdLabel: "OAuth 2.0 Client ID",
		clientSecretLabel: "OAuth 2.0 Client Secret",
		scopes: [
			"tweet.read",
			"tweet.write",
			"users.read",
			"media.write",
			"offline.access",
		],
		steps: [
			"No portal developer.x.com crie um Projeto e um App (a API de escrita é paga por uso).",
			"Em “User authentication settings” ative OAuth 2.0, tipo “Web App”, permissão “Read and write”.",
			"Cole a URL de retorno abaixo em “Callback URI / Redirect URL”.",
			"Copie o OAuth 2.0 Client ID e o Client Secret.",
		],
	},
	refreshWindowMs: 10 * 60_000,

	getAuthUrl: (ctx) =>
		withQuery("https://x.com/i/oauth2/authorize", {
			response_type: "code",
			client_id: ctx.clientId,
			redirect_uri: ctx.redirectUri,
			scope: x.setup!.scopes.join(" "),
			state: ctx.state,
			code_challenge: ctx.codeChallenge,
			code_challenge_method: "S256",
		}),

	async exchangeCode(ctx) {
		const t = await token(ctx, {
			code: ctx.code,
			grant_type: "authorization_code",
			redirect_uri: ctx.redirectUri,
			code_verifier: ctx.codeVerifier,
		});
		const { data } = await request(`${API}/users/me`, {
			query: { "user.fields": "profile_image_url" },
			bearer: t.access_token,
		});
		return [
			{
				externalId: data.data.id,
				name: data.data.name,
				username: data.data.username,
				avatarUrl: data.data.profile_image_url ?? null,
				credentials: {
					accessToken: t.access_token,
					refreshToken: t.refresh_token,
				},
				expiresAt: secondsFromNow(t.expires_in),
			},
		];
	},

	async refresh(account, app) {
		if (!app || !account.credentials.refreshToken) return null;
		const t = await token(app, {
			grant_type: "refresh_token",
			refresh_token: account.credentials.refreshToken,
		});
		return {
			credentials: {
				accessToken: t.access_token,
				refreshToken: t.refresh_token ?? account.credentials.refreshToken,
			},
			expiresAt: secondsFromNow(t.expires_in),
		};
	},

	async publish({ account, media, caption, log }) {
		const bearer = account.credentials.accessToken!;
		const { data: init } = await request(`${API}/media/upload/initialize`, {
			method: "POST",
			bearer,
			json: {
				media_type: media.mimeType,
				total_bytes: media.size,
				media_category: "tweet_video",
			},
		});
		const mediaId: string = init.data.id;

		for (let i = 0, offset = 0; offset < media.size; i++, offset += CHUNK) {
			const form = new FormData();
			form.set("segment_index", String(i));
			form.set(
				"media",
				new Blob([
					await readChunk(
						media.path,
						offset,
						Math.min(offset + CHUNK, media.size),
					),
				]),
			);
			await request(`${API}/media/upload/${mediaId}/append`, {
				method: "POST",
				bearer,
				body: form,
			});
		}
		const { data: fin } = await request(
			`${API}/media/upload/${mediaId}/finalize`,
			{ method: "POST", bearer },
		);
		log(`Mídia ${mediaId} enviada`);

		if (fin.data?.processing_info) {
			await poll(
				async () => {
					const { data } = await request(`${API}/media/upload`, {
						query: { command: "STATUS", media_id: mediaId },
						bearer,
					});
					const info = data.data?.processing_info;
					if (!info || info.state === "succeeded") return true;
					if (info.state === "failed")
						throw new ProviderError(
							`X falhou ao processar: ${info.error?.message ?? ""}`,
						);
					await sleep(Math.max(0, (info.check_after_secs ?? 2) * 1000 - 2000));
					return undefined;
				},
				{ intervalMs: 2000, what: "processamento do X" },
			);
		}

		const { data: tweet } = await request(`${API}/tweets`, {
			method: "POST",
			bearer,
			json: { text: caption, media: { media_ids: [mediaId] } },
		});
		return {
			externalId: tweet.data.id,
			url: `https://x.com/${account.username}/status/${tweet.data.id}`,
		};
	},
};
