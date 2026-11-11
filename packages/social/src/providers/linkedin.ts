import {
	firstLine,
	ProviderError,
	poll,
	readChunk,
	request,
	secondsFromNow,
	truncate,
	withQuery,
} from "../http";
import { MP4, type Provider } from "../types";

// Versões do LinkedIn expiram em ~1 ano: atualize anualmente.
const VERSION = "202610";

const restHeaders = (token: string) => ({
	Authorization: `Bearer ${token}`,
	"LinkedIn-Version": VERSION,
	"X-Restli-Protocol-Version": "2.0.0",
});

/** LinkedIn usa parênteses/vírgulas como sintaxe Rest.li: escapa a legenda. */
export function escapeLinkedIn(text: string): string {
	return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

export const linkedin: Provider = {
	id: "linkedin",
	name: "LinkedIn",
	brandColor: "#0A66C2",
	auth: "oauth",
	tagline: "Vídeo no seu perfil pessoal",
	requirements: "Publica no seu perfil pessoal do LinkedIn.",
	captionLimit: 3000,
	acceptedTypes: [MP4],
	maxSizeMB: 500,
	maxDurationSec: 30 * 60,
	setup: {
		consoleUrl: "https://www.linkedin.com/developers/apps",
		clientIdLabel: "Client ID",
		clientSecretLabel: "Primary Client Secret",
		scopes: ["openid", "profile", "email", "w_member_social"],
		steps: [
			"Em linkedin.com/developers/apps crie um app (é preciso vincular uma Página de empresa).",
			"Na aba Products, solicite “Share on LinkedIn” e “Sign In with LinkedIn using OpenID Connect”.",
			"Na aba Auth, cole a URL de retorno abaixo em “Authorized redirect URLs”.",
			"Copie o Client ID e o Primary Client Secret.",
			"A conexão do LinkedIn dura 60 dias; depois é só reconectar.",
		],
	},

	getAuthUrl: (ctx) =>
		withQuery("https://www.linkedin.com/oauth/v2/authorization", {
			response_type: "code",
			client_id: ctx.clientId,
			redirect_uri: ctx.redirectUri,
			state: ctx.state,
			scope: linkedin.setup!.scopes.join(" "),
		}),

	async exchangeCode(ctx) {
		const { data: token } = await request(
			"https://www.linkedin.com/oauth/v2/accessToken",
			{
				method: "POST",
				form: {
					grant_type: "authorization_code",
					code: ctx.code,
					client_id: ctx.clientId,
					client_secret: ctx.clientSecret,
					redirect_uri: ctx.redirectUri,
				},
			},
		);
		const { data: me } = await request("https://api.linkedin.com/v2/userinfo", {
			bearer: token.access_token,
		});
		return [
			{
				externalId: me.sub,
				name: me.name,
				username: me.email ?? null,
				avatarUrl: me.picture ?? null,
				credentials: {
					accessToken: token.access_token,
					refreshToken: token.refresh_token,
				},
				expiresAt: secondsFromNow(token.expires_in),
			},
		];
	},

	async publish({ account, media, caption, options, log }) {
		const token = account.credentials.accessToken!;
		const owner = `urn:li:person:${account.externalId}`;
		const headers = restHeaders(token);

		const { data: init } = await request(
			"https://api.linkedin.com/rest/videos?action=initializeUpload",
			{
				method: "POST",
				headers,
				json: {
					initializeUploadRequest: {
						owner,
						fileSizeBytes: media.size,
						uploadCaptions: false,
						uploadThumbnail: false,
					},
				},
			},
		);
		const { video, uploadToken, uploadInstructions } = init.value as {
			video: string;
			uploadToken: string;
			uploadInstructions: {
				uploadUrl: string;
				firstByte: number;
				lastByte: number;
			}[];
		};

		const etags: string[] = [];
		for (const part of uploadInstructions) {
			const { res } = await request(part.uploadUrl, {
				method: "PUT",
				headers: { "Content-Type": "application/octet-stream" },
				body: await readChunk(media.path, part.firstByte, part.lastByte + 1),
			});
			const etag = res.headers.get("etag");
			if (!etag)
				throw new ProviderError("LinkedIn não retornou ETag do upload");
			etags.push(etag);
		}
		log(`Upload em ${etags.length} parte(s)`);

		await request(
			"https://api.linkedin.com/rest/videos?action=finalizeUpload",
			{
				method: "POST",
				headers,
				json: {
					finalizeUploadRequest: {
						video,
						uploadToken: uploadToken ?? "",
						uploadedPartIds: etags,
					},
				},
			},
		);

		await poll(
			async () => {
				const { data } = await request(
					`https://api.linkedin.com/rest/videos/${encodeURIComponent(video)}`,
					{ headers },
				);
				if (data.status === "AVAILABLE") return true;
				if (data.status === "PROCESSING_FAILED")
					throw new ProviderError("LinkedIn falhou ao processar o vídeo");
				return undefined;
			},
			{ what: "processamento do LinkedIn" },
		);

		const { res } = await request("https://api.linkedin.com/rest/posts", {
			method: "POST",
			headers,
			json: {
				author: owner,
				commentary: escapeLinkedIn(caption),
				visibility: "PUBLIC",
				distribution: {
					feedDistribution: "MAIN_FEED",
					targetEntities: [],
					thirdPartyDistributionChannels: [],
				},
				content: {
					media: {
						title: truncate(
							String(options.title || firstLine(caption, "Vídeo")),
							200,
						),
						id: video,
					},
				},
				lifecycleState: "PUBLISHED",
				isReshareDisabledByAuthor: false,
			},
		});
		const postUrn = res.headers.get("x-restli-id") ?? video;
		return {
			externalId: postUrn,
			url: `https://www.linkedin.com/feed/update/${postUrn}/`,
		};
	},
};
