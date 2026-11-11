/** O que a pessoa pode fazer a respeito de uma falha. */
export type ErrorAction =
	| "reconnect"
	| "replace-video"
	| "retry"
	| "configure"
	| null;

export type HumanError = {
	message: string;
	detail: string;
	action: ErrorAction;
};

const RULES: { test: RegExp; message: string; action: ErrorAction }[] = [
	{
		test: /unaudited_client_can_only_post_to_private_accounts/i,
		message:
			"Sem a auditoria do app, o TikTok só publica em contas privadas. Deixe a conta privada no app do TikTok.",
		action: "retry",
	},
	{
		test: /não está configurado/i,
		message: "Esta rede ainda não foi configurada pelo administrador.",
		action: "configure",
	},
	{
		test: /\b401\b|invalid_grant|expired|expirad|reconect|access_token_invalid|OAuthException|token.*(inválid|invalid|revog)/i,
		message:
			"A conexão com a rede expirou ou foi desfeita. Reconecte a conta e tente de novo.",
		action: "reconnect",
	},
	{
		test: /formato|format|codec|unsupported|não é aceito/i,
		message: "A rede não aceitou o formato deste vídeo. Envie em MP4.",
		action: "replace-video",
	},
	{
		test: /maior que|too large|file.?size|duration|duração|mais longo|too long/i,
		message: "O vídeo passou do limite de tamanho ou de duração desta rede.",
		action: "replace-video",
	},
	{
		test: /\b429\b|rate.?limit|too many|spam|quota|limite diário/i,
		message: "A rede limitou os envios por agora. Tente de novo mais tarde.",
		action: "retry",
	},
	{
		test: /falha de rede|ECONN|fetch failed|tempo esgotado|timeout|\b5\d\d\b/i,
		message: "A rede ficou instável durante o envio. Tente de novo.",
		action: "retry",
	},
	{
		test: /falha simulada/i,
		message: "Falha simulada (rede de teste).",
		action: "retry",
	},
];

/** Traduz o erro técnico da plataforma para algo que a equipe entende e sabe resolver. */
export function humanizeError(
	raw: string | null | undefined,
): HumanError | null {
	if (!raw) return null;
	const rule = RULES.find((r) => r.test.test(raw));
	return {
		message:
			rule?.message ??
			"A rede recusou a publicação. Veja os detalhes ou tente de novo.",
		detail: raw,
		action: rule ? rule.action : "retry",
	};
}
