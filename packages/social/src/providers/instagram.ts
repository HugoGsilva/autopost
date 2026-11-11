import {
	ProviderError,
	poll,
	request,
	secondsFromNow,
	withQuery,
} from "../http";
import { type AccountForPublish, MOV, MP4, type Provider } from "../types";

const GRAPH = "https://graph.instagram.com";
const VERSION = "v24.0";

async function longLived(shortToken: string, clientSecret: string) {
	const { data } = await request(`${GRAPH}/access_token`, {
		query: {
			grant_type: "ig_exchange_token",
			client_secret: clientSecret,
			access_token: shortToken,
		},
	});
	return {
		accessToken: data.access_token as string,
		expiresAt: secondsFromNow(data.expires_in),
	};
}

export const instagram: Provider = {
	id: "instagram",
	name: "Instagram",
	brandColor: "#E4405F",
	auth: "oauth",
	tagline: "Reels na conta profissional (Business ou Creator)",
	requirements:
		"Precisa ser conta Profissional do Instagram (Comercial ou Criador de conteúdo).",
	captionLimit: 2200,
	acceptedTypes: [MP4, MOV],
	preferredAspect: "vertical",
	requiresPublicUrl: true,
	maxSizeMB: 300,
	maxDurationSec: 15 * 60,
	setup: {
		consoleUrl: "https://developers.facebook.com/apps/",
		clientIdLabel: "Instagram App ID",
		clientSecretLabel: "Instagram App Secret",
		scopes: ["instagram_business_basic", "instagram_business_content_publish"],
		steps: [
			"Acesse developers.facebook.com/apps e crie um app do tipo “Empresa” (Business).",
			"Adicione o produto “Instagram” → “API com login do Instagram”.",
			"Em “Configurar login comercial do Instagram”, cole a URL de retorno abaixo em “URIs de redirecionamento OAuth válidos”.",
			"Copie o “ID do app do Instagram” e a “Chave secreta do app do Instagram” para os campos abaixo.",
			"Enquanto o app estiver em modo de desenvolvimento, adicione as contas do Instagram como “Testadoras” (Funções do app). Para contas de terceiros, envie o app para revisão.",
		],
	},
	refreshWindowMs: 10 * 24 * 3600_000,

	getAuthUrl: (ctx) =>
		withQuery("https://www.instagram.com/oauth/authorize", {
			client_id: ctx.clientId,
			redirect_uri: ctx.redirectUri,
			response_type: "code",
			scope: instagram.setup!.scopes.join(","),
			state: ctx.state,
			enable_fb_login: 0,
			force_authentication: 1,
		}),

	async exchangeCode(ctx) {
		const { data } = await request(
			"https://api.instagram.com/oauth/access_token",
			{
				method: "POST",
				form: {
					client_id: ctx.clientId,
					client_secret: ctx.clientSecret,
					grant_type: "authorization_code",
					redirect_uri: ctx.redirectUri,
					code: ctx.code,
				},
			},
		);
		const short = (data.data?.[0] ?? data) as { access_token: string };
		const token = await longLived(short.access_token, ctx.clientSecret);
		const { data: me } = await request(`${GRAPH}/${VERSION}/me`, {
			query: {
				fields: "user_id,username,name,profile_picture_url,account_type",
				access_token: token.accessToken,
			},
		});
		return [
			{
				externalId: String(me.user_id ?? me.id),
				name: me.name || me.username,
				username: me.username,
				avatarUrl: me.profile_picture_url ?? null,
				credentials: { accessToken: token.accessToken },
				expiresAt: token.expiresAt,
				meta: { accountType: me.account_type },
			},
		];
	},

	async refresh(account) {
		const { data } = await request(`${GRAPH}/refresh_access_token`, {
			query: {
				grant_type: "ig_refresh_token",
				access_token: account.credentials.accessToken,
			},
		});
		return {
			credentials: { accessToken: data.access_token },
			expiresAt: secondsFromNow(data.expires_in),
		};
	},

	async publish({ account, media, caption, log }) {
		const token = account.credentials.accessToken!;
		const base = `${GRAPH}/${VERSION}`;

		const { data: container } = await request(
			`${base}/${account.externalId}/media`,
			{
				method: "POST",
				form: {
					media_type: "REELS",
					caption,
					share_to_feed: "true",
					// O Instagram baixa o vídeo desta URL (upload direto só existe no login via Facebook).
					video_url: media.publicUrl,
					access_token: token,
				},
			},
		);
		log(`Container criado: ${container.id}`);

		await waitContainer(base, container.id, token);
		const { data: published } = await request(
			`${base}/${account.externalId}/media_publish`,
			{
				method: "POST",
				form: { creation_id: container.id, access_token: token },
			},
		);
		const permalink = await getPermalink(base, published.id, token, account);
		return { externalId: published.id, url: permalink };
	},
};

async function waitContainer(base: string, id: string, token: string) {
	await poll(
		async () => {
			const { data } = await request(`${base}/${id}`, {
				query: { fields: "status_code,status", access_token: token },
			});
			if (data.status_code === "FINISHED") return true;
			if (data.status_code === "ERROR" || data.status_code === "EXPIRED")
				throw new ProviderError(
					`Instagram recusou o vídeo: ${data.status ?? data.status_code}`,
				);
			return undefined;
		},
		{ what: "processamento do Instagram" },
	);
}

async function getPermalink(
	base: string,
	id: string,
	token: string,
	account: AccountForPublish,
) {
	try {
		const { data } = await request(`${base}/${id}`, {
			query: { fields: "permalink", access_token: token },
		});
		return data.permalink as string;
	} catch {
		return account.username
			? `https://www.instagram.com/${account.username}/`
			: null;
	}
}
