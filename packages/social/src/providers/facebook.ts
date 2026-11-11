import { fileBlob, request, truncate, withQuery } from "../http";
import { MOV, MP4, type Provider, WEBM } from "../types";

const VERSION = "v24.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

export const facebook: Provider = {
	id: "facebook",
	name: "Facebook",
	brandColor: "#0866FF",
	auth: "oauth",
	tagline: "Vídeos nas Páginas que você administra",
	requirements: "Você precisa ser administrador da Página.",
	captionLimit: 5000,
	acceptedTypes: [MP4, MOV, WEBM],
	maxSizeMB: 1024,
	setup: {
		consoleUrl: "https://developers.facebook.com/apps/",
		clientIdLabel: "App ID",
		clientSecretLabel: "App Secret",
		scopes: [
			"pages_show_list",
			"pages_read_engagement",
			"pages_manage_posts",
			"business_management",
		],
		steps: [
			"Em developers.facebook.com/apps crie (ou reutilize) um app do tipo “Empresa”.",
			"Adicione o produto “Login do Facebook para Empresas” e cole a URL de retorno abaixo em “URIs de redirecionamento OAuth válidos”.",
			"Em Configurações → Básico, copie o “ID do app” e a “Chave secreta do app”.",
			"Em modo de desenvolvimento só administradores/testadores do app conseguem conectar. Para uso geral, peça as permissões na Revisão do App.",
		],
	},

	getAuthUrl: (ctx) =>
		withQuery(`https://www.facebook.com/${VERSION}/dialog/oauth`, {
			client_id: ctx.clientId,
			redirect_uri: ctx.redirectUri,
			state: ctx.state,
			response_type: "code",
			scope: facebook.setup!.scopes.join(","),
		}),

	async exchangeCode(ctx) {
		const { data: short } = await request(`${GRAPH}/oauth/access_token`, {
			query: {
				client_id: ctx.clientId,
				client_secret: ctx.clientSecret,
				redirect_uri: ctx.redirectUri,
				code: ctx.code,
			},
		});
		const { data: long } = await request(`${GRAPH}/oauth/access_token`, {
			query: {
				grant_type: "fb_exchange_token",
				client_id: ctx.clientId,
				client_secret: ctx.clientSecret,
				fb_exchange_token: short.access_token,
			},
		});
		const { data: pages } = await request(`${GRAPH}/me/accounts`, {
			query: {
				fields: "id,name,username,access_token,picture{url}",
				limit: 100,
				access_token: long.access_token,
			},
		});
		const list = (pages.data ?? []) as any[];
		if (!list.length)
			throw new Error(
				"Nenhuma Página do Facebook encontrada para este usuário.",
			);
		// Token de Página obtido a partir de token de usuário de longa duração não expira.
		return list.map((p) => ({
			externalId: p.id,
			name: p.name,
			username: p.username ?? null,
			avatarUrl: p.picture?.data?.url ?? null,
			credentials: { accessToken: p.access_token },
			expiresAt: null,
		}));
	},

	async publish({ account, media, caption, options }) {
		const form = new FormData();
		form.set("access_token", account.credentials.accessToken!);
		form.set("description", caption);
		if (options.title) form.set("title", truncate(String(options.title), 250));
		form.set(
			"source",
			await fileBlob(media.path, media.mimeType),
			media.fileName,
		);
		const { data } = await request(
			`https://graph-video.facebook.com/${VERSION}/${account.externalId}/videos`,
			{
				method: "POST",
				body: form,
			},
		);
		return {
			externalId: data.id,
			url: `https://www.facebook.com/${account.externalId}/videos/${data.id}`,
		};
	},
};
