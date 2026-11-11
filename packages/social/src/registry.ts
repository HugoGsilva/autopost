import { facebook } from "./providers/facebook";
import { instagram } from "./providers/instagram";
import { linkedin } from "./providers/linkedin";
import { bluesky, demo, discord, telegram } from "./providers/manual";
import { pinterest } from "./providers/pinterest";
import { threads } from "./providers/threads";
import { tiktok } from "./providers/tiktok";
import { x } from "./providers/x";
import { youtube } from "./providers/youtube";
import type { PlatformId, Provider, ProviderInfo } from "./types";

export const providers: Record<PlatformId, Provider> = {
	instagram,
	facebook,
	youtube,
	tiktok,
	linkedin,
	x,
	threads,
	pinterest,
	bluesky,
	telegram,
	discord,
	demo,
};

export function getProvider(id: string): Provider {
	const p = providers[id as PlatformId];
	if (!p) throw new Error(`Plataforma desconhecida: ${id}`);
	return p;
}

/** Somente dados serializáveis, para a interface. */
export function providerInfo(p: Provider): ProviderInfo {
	const {
		getAuthUrl,
		exchangeCode,
		connectManual,
		refresh,
		publish,
		refreshWindowMs,
		...info
	} = p;
	return info;
}

export function listProviderInfo(): ProviderInfo[] {
	return Object.values(providers).map(providerInfo);
}
