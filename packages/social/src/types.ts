import type { TargetOptions } from "@autopost/db/schema/social";

export const PLATFORM_IDS = [
	"instagram",
	"facebook",
	"youtube",
	"tiktok",
	"linkedin",
	"x",
	"threads",
	"pinterest",
	"bluesky",
	"telegram",
	"discord",
	"demo",
] as const;

export const MP4 = "video/mp4";
export const MOV = "video/quicktime";
export const WEBM = "video/webm";

export type PlatformId = (typeof PLATFORM_IDS)[number];

export type Credentials = {
	accessToken?: string;
	refreshToken?: string;
	[k: string]: unknown;
};

export type ManualField = {
	key: string;
	label: string;
	type?: "text" | "password" | "url";
	placeholder?: string;
	help?: string;
	optional?: boolean;
};

export type OptionField =
	| {
			key: string;
			label: string;
			kind: "text";
			placeholder?: string;
			maxLength?: number;
			help?: string;
	  }
	| {
			key: string;
			label: string;
			kind: "select";
			/** "meta:boards" → opções vêm de account.meta.boards */
			choices: { value: string; label: string }[] | `meta:${string}`;
			help?: string;
	  };

/** Metadados serializáveis (vão para a interface). */
export type ProviderInfo = {
	id: PlatformId;
	name: string;
	/** Cor de marca da plataforma (dado, não token de UI). */
	brandColor: string;
	auth: "oauth" | "manual";
	tagline: string;
	/** O que a pessoa precisa ter antes de conectar (mostrado antes do login). */
	requirements?: string;
	captionLimit: number;
	/** Tipos MIME de vídeo aceitos pela rede. */
	acceptedTypes: string[];
	/** Recomendação de formato exibida no compositor (ex.: vertical 9:16). */
	preferredAspect?: "vertical" | "horizontal";
	maxSizeMB?: number;
	maxDurationSec?: number;
	/** Se true, a plataforma baixa o vídeo de uma URL pública do autopost. */
	requiresPublicUrl?: boolean;
	manualFields?: ManualField[];
	optionFields?: OptionField[];
	setup?: {
		consoleUrl: string;
		steps: string[];
		scopes: string[];
		clientIdLabel?: string;
		clientSecretLabel?: string;
	};
	warning?: string;
};

export type AppCredentials = {
	clientId: string;
	clientSecret: string;
	extra?: Record<string, string>;
};

export type AuthUrlContext = AppCredentials & {
	redirectUri: string;
	state: string;
	codeChallenge: string;
};

export type ExchangeContext = AppCredentials & {
	redirectUri: string;
	code: string;
	codeVerifier: string;
};

export type ConnectedAccount = {
	externalId: string;
	name: string;
	username?: string | null;
	avatarUrl?: string | null;
	credentials: Credentials;
	expiresAt?: Date | null;
	meta?: Record<string, unknown>;
};

export type AccountForPublish = {
	externalId: string;
	name: string;
	username: string | null;
	credentials: Credentials;
	meta: Record<string, unknown>;
};

export type MediaForPublish = {
	path: string;
	size: number;
	mimeType: string;
	fileName: string;
	publicUrl: string;
	durationSec?: number | null;
	width?: number | null;
	height?: number | null;
};

export type PublishInput = {
	account: AccountForPublish;
	media: MediaForPublish;
	caption: string;
	options: TargetOptions;
	app: AppCredentials | null;
	log: (msg: string) => void;
};

export type PublishResult = {
	externalId: string;
	url?: string | null;
	/** Aviso para a equipe (algo foi aplicado diferente do pedido). */
	note?: string;
};

export type RefreshResult = {
	credentials: Credentials;
	expiresAt: Date | null;
} | null;

export type Provider = ProviderInfo & {
	getAuthUrl?: (ctx: AuthUrlContext) => string;
	exchangeCode?: (ctx: ExchangeContext) => Promise<ConnectedAccount[]>;
	connectManual?: (fields: Record<string, string>) => Promise<ConnectedAccount>;
	/** Renova o token. Chamado quando expira em breve (`refreshWindowMs`). */
	refresh?: (
		account: AccountForPublish,
		app: AppCredentials | null,
	) => Promise<RefreshResult>;
	refreshWindowMs?: number;
	publish: (input: PublishInput) => Promise<PublishResult>;
};
