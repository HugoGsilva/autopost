import {
	ProviderError,
	poll,
	request,
	secondsFromNow,
	withQuery,
} from "../http";
import { MOV, MP4, type Provider } from "../types";

const GRAPH = "https://graph.threads.com";
const VERSION = "v1.0";

export const threads: Provider = {
	id: "threads",
	name: "Threads",
	brandColor: "#101010",
	auth: "oauth",
	tagline: "Vídeo com texto no seu perfil do Threads",
	requirements: "Perfil do Threads (ligado ao Instagram).",
	captionLimit: 500,
	acceptedTypes: [MP4, MOV],
	preferredAspect: "vertical",
	maxSizeMB: 1024,
	maxDurationSec: 5 * 60,
	requiresPublicUrl: true,
	setup: {
		consoleUrl: "https://developers.facebook.com/apps/",
		clientIdLabel: "Threads App ID",
		clientSecretLabel: "Threads App Secret",
		scopes: ["threads_basic", "threads_content_publish"],
		steps: [
			"Em developers.facebook.com/apps crie um app com o caso de uso “Acessar a API do Threads”.",
			"Em Casos de uso → Personalizar → Configurações, cole a URL de retorno abaixo em “URLs de retorno de chamada”.",
			"Copie o “ID do app do Threads” e a “Chave secreta do app do Threads”.",
			"Adicione seu perfil como “Testador do Threads” e aceite o convite em threads.com → Configurações → Conta → Permissões do site.",
		],
	},
	refreshWindowMs: 10 * 24 * 3600_000,

	getAuthUrl: (ctx) =>
		withQuery("https://threads.com/oauth/authorize", {
			client_id: ctx.clientId,
			redirect_uri: ctx.redirectUri,
			scope: threads.setup!.scopes.join(","),
			response_type: "code",
			state: ctx.state,
		}),

	async exchangeCode(ctx) {
		const { data: short } = await request(`${GRAPH}/oauth/access_token`, {
			method: "POST",
			form: {
				client_id: ctx.clientId,
				client_secret: ctx.clientSecret,
				grant_type: "authorization_code",
				redirect_uri: ctx.redirectUri,
				code: ctx.code,
			},
		});
		const { data: long } = await request(`${GRAPH}/access_token`, {
			query: {
				grant_type: "th_exchange_token",
				client_secret: ctx.clientSecret,
				access_token: short.access_token,
			},
		});
		const { data: me } = await request(`${GRAPH}/${VERSION}/me`, {
			query: {
				fields: "id,username,name,threads_profile_picture_url",
				access_token: long.access_token,
			},
		});
		return [
			{
				externalId: String(me.id),
				name: me.name || me.username,
				username: me.username,
				avatarUrl: me.threads_profile_picture_url ?? null,
				credentials: { accessToken: long.access_token },
				expiresAt: secondsFromNow(long.expires_in),
			},
		];
	},

	async refresh(account) {
		const { data } = await request(`${GRAPH}/refresh_access_token`, {
			query: {
				grant_type: "th_refresh_token",
				access_token: account.credentials.accessToken,
			},
		});
		return {
			credentials: { accessToken: data.access_token },
			expiresAt: secondsFromNow(data.expires_in),
		};
	},

	async publish({ account, media, caption }) {
		const token = account.credentials.accessToken!;
		const base = `${GRAPH}/${VERSION}`;
		const { data: container } = await request(
			`${base}/${account.externalId}/threads`,
			{
				method: "POST",
				form: {
					media_type: "VIDEO",
					video_url: media.publicUrl,
					text: caption,
					access_token: token,
				},
			},
		);
		await poll(
			async () => {
				const { data } = await request(`${base}/${container.id}`, {
					query: { fields: "status,error_message", access_token: token },
				});
				if (data.status === "FINISHED") return true;
				if (data.status === "ERROR" || data.status === "EXPIRED")
					throw new ProviderError(
						`Threads recusou o vídeo: ${data.error_message ?? data.status}`,
					);
				return undefined;
			},
			{ what: "processamento do Threads" },
		);
		const { data: published } = await request(
			`${base}/${account.externalId}/threads_publish`,
			{
				method: "POST",
				form: { creation_id: container.id, access_token: token },
			},
		);
		let url: string | null = `https://www.threads.com/@${account.username}`;
		try {
			const { data } = await request(`${base}/${published.id}`, {
				query: { fields: "permalink", access_token: token },
			});
			url = data.permalink ?? url;
		} catch {}
		return { externalId: published.id, url };
	},
};
