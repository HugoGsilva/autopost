/**
 * Regras de tela do Direct Post do TikTok (Content Sharing Guidelines).
 * Sem dependências de servidor: o compositor (navegador) e o worker usam as mesmas regras.
 */

export const TIKTOK_PRIVACY_LABELS: Record<string, string> = {
	PUBLIC_TO_EVERYONE: "Todos",
	MUTUAL_FOLLOW_FRIENDS: "Amigos",
	FOLLOWER_OF_CREATOR: "Seguidores",
	SELF_ONLY: "Só eu",
};

export type TikTokCreatorInfo = {
	nickname: string;
	username: string | null;
	avatarUrl: string | null;
	privacyOptions: string[];
	commentDisabled: boolean;
	duetDisabled: boolean;
	stitchDisabled: boolean;
	maxDurationSec: number | null;
};

/** Opções do post direto, escolhidas pelo usuário no compositor (regras de tela do TikTok). */
export type TikTokPostOptions = {
	privacy: string;
	allowComment: boolean;
	allowDuet: boolean;
	allowStitch: boolean;
	/** "Sua marca": promove o próprio criador ou negócio (rótulo "Conteúdo promocional"). */
	brandOrganic: boolean;
	/** "Conteúdo de marca": promove terceiros (rótulo "Parceria paga"). */
	brandContent: boolean;
};

const flag = (v: unknown) => v === true || v === "true";

export function tiktokPostOptions(
	options: Record<string, unknown>,
): TikTokPostOptions {
	const commercial = flag(options.commercial);
	return {
		privacy: typeof options.privacy === "string" ? options.privacy : "",
		allowComment: flag(options.allowComment),
		allowDuet: flag(options.allowDuet),
		allowStitch: flag(options.allowStitch),
		brandOrganic: commercial && flag(options.brandOrganic),
		brandContent: commercial && flag(options.brandContent),
	};
}

/** O que impede o post direto com essas opções (mesmas regras na tela e na hora de publicar). */
export function tiktokPostProblems(
	options: Record<string, unknown>,
	creator?: Pick<TikTokCreatorInfo, "privacyOptions" | "maxDurationSec">,
	durationSec?: number | null,
): string[] {
	if (options.mode === "inbox") return [];
	const o = tiktokPostOptions(options);
	const out: string[] = [];
	if (!o.privacy) out.push("Escolha quem pode ver o vídeo no TikTok");
	else if (creator && !creator.privacyOptions.includes(o.privacy))
		out.push("Essa privacidade não está disponível para esta conta do TikTok");
	if (flag(options.commercial) && !o.brandOrganic && !o.brandContent)
		out.push(
			"Indique se o conteúdo promove você, uma marca de terceiros ou os dois",
		);
	if (o.brandContent && o.privacy === "SELF_ONLY")
		out.push("Conteúdo de marca não pode ser publicado como “Só eu”");
	if (
		creator?.maxDurationSec &&
		durationSec &&
		durationSec > creator.maxDurationSec
	)
		out.push(
			`Esta conta do TikTok aceita vídeos de até ${Math.floor(creator.maxDurationSec / 60)} min`,
		);
	return out;
}
