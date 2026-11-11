import {
	fileBlob,
	firstLine,
	ProviderError,
	request,
	secondsFromNow,
	truncate,
	withQuery,
} from "../http";
import { MOV, MP4, type Provider, WEBM } from "../types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const youtube: Provider = {
	id: "youtube",
	name: "YouTube",
	brandColor: "#FF0000",
	auth: "oauth",
	tagline: "Vídeos e Shorts (vertical até 3 min vira Short)",
	requirements: "Uma conta Google com canal no YouTube.",
	captionLimit: 5000,
	acceptedTypes: [MP4, MOV, WEBM],
	optionFields: [
		{
			key: "title",
			label: "Título do vídeo",
			kind: "text",
			maxLength: 100,
			placeholder: "Usa a 1ª linha da legenda se vazio",
		},
		{
			key: "privacy",
			label: "Visibilidade",
			kind: "select",
			choices: [
				{ value: "public", label: "Público" },
				{ value: "unlisted", label: "Não listado" },
				{ value: "private", label: "Privado" },
			],
		},
	],
	setup: {
		consoleUrl: "https://console.cloud.google.com/apis/credentials",
		clientIdLabel: "Client ID",
		clientSecretLabel: "Client Secret",
		scopes: [
			"https://www.googleapis.com/auth/youtube.upload",
			"https://www.googleapis.com/auth/youtube.readonly",
		],
		steps: [
			"No Google Cloud Console crie um projeto e ative a “YouTube Data API v3”.",
			"Configure a “Tela de consentimento OAuth” (tipo Externo) e adicione seu e-mail como usuário de teste.",
			"Em Credenciais → Criar credenciais → ID do cliente OAuth → “Aplicativo da Web”. Cole a URL de retorno abaixo em “URIs de redirecionamento autorizados”.",
			"Copie o Client ID e o Client Secret.",
			"Atenção: com o app em modo “Teste”, a conexão expira a cada 7 dias e os vídeos podem ficar privados até o projeto passar pela auditoria do YouTube.",
		],
	},
	refreshWindowMs: 5 * 60_000,

	getAuthUrl: (ctx) =>
		withQuery("https://accounts.google.com/o/oauth2/v2/auth", {
			client_id: ctx.clientId,
			redirect_uri: ctx.redirectUri,
			response_type: "code",
			scope: youtube.setup!.scopes.join(" "),
			access_type: "offline",
			prompt: "consent",
			include_granted_scopes: "true",
			state: ctx.state,
		}),

	async exchangeCode(ctx) {
		const { data: token } = await request(TOKEN_URL, {
			method: "POST",
			form: {
				code: ctx.code,
				client_id: ctx.clientId,
				client_secret: ctx.clientSecret,
				redirect_uri: ctx.redirectUri,
				grant_type: "authorization_code",
			},
		});
		const { data } = await request(
			"https://www.googleapis.com/youtube/v3/channels",
			{
				query: { part: "snippet", mine: "true" },
				bearer: token.access_token,
			},
		);
		const channels = (data.items ?? []) as any[];
		if (!channels.length)
			throw new Error("Esta conta Google não tem canal do YouTube.");
		return channels.map((c) => ({
			externalId: c.id,
			name: c.snippet.title,
			username: c.snippet.customUrl ?? null,
			avatarUrl: c.snippet.thumbnails?.default?.url ?? null,
			credentials: {
				accessToken: token.access_token,
				refreshToken: token.refresh_token,
			},
			expiresAt: secondsFromNow(token.expires_in),
		}));
	},

	async refresh(account, app) {
		if (!account.credentials.refreshToken || !app) return null;
		const { data } = await request(TOKEN_URL, {
			method: "POST",
			form: {
				client_id: app.clientId,
				client_secret: app.clientSecret,
				refresh_token: account.credentials.refreshToken,
				grant_type: "refresh_token",
			},
		});
		return {
			credentials: { ...account.credentials, accessToken: data.access_token },
			expiresAt: secondsFromNow(data.expires_in),
		};
	},

	async publish({ account, media, caption, options, log }) {
		const title = truncate(
			String(
				options.title ||
					firstLine(caption, media.fileName.replace(/\.[^.]+$/, "")),
			),
			100,
		);
		const { res } = await request(
			"https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
			{
				method: "POST",
				bearer: account.credentials.accessToken,
				headers: {
					"X-Upload-Content-Length": String(media.size),
					"X-Upload-Content-Type": media.mimeType,
				},
				json: {
					snippet: { title, description: caption, categoryId: "22" },
					status: {
						privacyStatus: options.privacy || "public",
						selfDeclaredMadeForKids: false,
					},
				},
			},
		);
		const location = res.headers.get("location");
		if (!location)
			throw new ProviderError("YouTube não retornou a URL de upload");
		log("Sessão de upload criada");
		const { data } = await request(location, {
			method: "PUT",
			bearer: account.credentials.accessToken,
			headers: { "Content-Type": media.mimeType },
			body: await fileBlob(media.path, media.mimeType),
		});
		const isShort =
			(media.durationSec ?? 999) <= 180 &&
			(media.height ?? 0) > (media.width ?? 0);
		return {
			externalId: data.id,
			url: isShort
				? `https://www.youtube.com/shorts/${data.id}`
				: `https://youtu.be/${data.id}`,
		};
	},
};
