import {
	basicAuth,
	fileBlob,
	firstLine,
	ProviderError,
	poll,
	request,
	secondsFromNow,
	truncate,
	withQuery,
} from "../http";
import { type AppCredentials, MOV, MP4, type Provider } from "../types";

const API = "https://api.pinterest.com/v5";

async function token(app: AppCredentials, form: Record<string, string>) {
	const { data } = await request(`${API}/oauth/token`, {
		method: "POST",
		headers: { Authorization: basicAuth(app.clientId, app.clientSecret) },
		form,
	});
	return data;
}

async function listBoards(accessToken: string) {
	const { data } = await request(`${API}/boards`, {
		query: { page_size: 100 },
		bearer: accessToken,
	});
	return ((data.items ?? []) as any[]).map((b) => ({
		value: String(b.id),
		label: String(b.name),
	}));
}

export const pinterest: Provider = {
	id: "pinterest",
	name: "Pinterest",
	brandColor: "#BD081C",
	auth: "oauth",
	tagline: "Pin de vídeo em uma pasta",
	requirements: "Conta empresarial do Pinterest com pelo menos uma pasta.",
	captionLimit: 500,
	acceptedTypes: [MP4, MOV],
	preferredAspect: "vertical",
	maxSizeMB: 2048,
	maxDurationSec: 15 * 60,
	optionFields: [
		{ key: "boardId", label: "Pasta", kind: "select", choices: "meta:boards" },
		{ key: "title", label: "Título do Pin", kind: "text", maxLength: 100 },
	],
	setup: {
		consoleUrl: "https://developers.pinterest.com/apps/",
		clientIdLabel: "App ID",
		clientSecretLabel: "App secret key",
		scopes: ["boards:read", "pins:read", "pins:write", "user_accounts:read"],
		steps: [
			"Em developers.pinterest.com/apps conecte uma conta empresarial e crie um app.",
			"Cole a URL de retorno abaixo em “Redirect URIs”.",
			"Copie o App ID e a App secret key.",
			"Apps em “Trial access” só criam Pins visíveis para você; peça “Standard access” para publicar em público.",
		],
	},
	refreshWindowMs: 3 * 24 * 3600_000,

	getAuthUrl: (ctx) =>
		withQuery("https://www.pinterest.com/oauth/", {
			client_id: ctx.clientId,
			redirect_uri: ctx.redirectUri,
			response_type: "code",
			scope: pinterest.setup!.scopes.join(","),
			state: ctx.state,
		}),

	async exchangeCode(ctx) {
		const t = await token(ctx, {
			grant_type: "authorization_code",
			// Apps antigos precisam pedir o refresh token contínuo (60 dias, renovável).
			continuous_refresh: "true",
			code: ctx.code,
			redirect_uri: ctx.redirectUri,
		});
		const { data: me } = await request(`${API}/user_account`, {
			bearer: t.access_token,
		});
		const boards = await listBoards(t.access_token);
		return [
			{
				externalId: String(me.id ?? me.username),
				name: me.business_name || me.username,
				username: me.username,
				avatarUrl: me.profile_image ?? null,
				credentials: {
					accessToken: t.access_token,
					refreshToken: t.refresh_token,
				},
				expiresAt: secondsFromNow(t.expires_in),
				meta: { boards },
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

	async publish({ account, media, caption, options, log }) {
		const bearer = account.credentials.accessToken!;
		const boards =
			(account.meta.boards as { value: string }[] | undefined) ?? [];
		const boardId = String(options.boardId || boards[0]?.value || "");
		if (!boardId)
			throw new ProviderError(
				"Escolha uma pasta do Pinterest (nenhuma encontrada na conta)",
			);

		const { data: reg } = await request(`${API}/media`, {
			method: "POST",
			bearer,
			json: { media_type: "video" },
		});
		const form = new FormData();
		for (const [k, v] of Object.entries(reg.upload_parameters ?? {}))
			form.set(k, String(v));
		form.set(
			"file",
			await fileBlob(media.path, media.mimeType),
			media.fileName,
		);
		await request(reg.upload_url, { method: "POST", body: form });
		log(`Mídia ${reg.media_id} enviada`);

		await poll(
			async () => {
				const { data } = await request(`${API}/media/${reg.media_id}`, {
					bearer,
				});
				if (data.status === "succeeded") return true;
				if (data.status === "failed")
					throw new ProviderError("Pinterest falhou ao processar o vídeo");
				return undefined;
			},
			{ what: "processamento do Pinterest" },
		);

		const { data: pin } = await request(`${API}/pins`, {
			method: "POST",
			bearer,
			json: {
				board_id: boardId,
				title: truncate(
					String(options.title || firstLine(caption, "Vídeo")),
					100,
				),
				description: truncate(caption, 500),
				media_source: {
					source_type: "video_id",
					media_id: reg.media_id,
					cover_image_key_frame_time: 1,
				},
			},
		});
		return {
			externalId: pin.id,
			url: `https://www.pinterest.com/pin/${pin.id}/`,
		};
	},
};
