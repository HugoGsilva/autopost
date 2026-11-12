/**
 * Dados públicos da empresa usados no site, nos Termos e na Política de Privacidade.
 */
export const COMPANY = {
	brand: "IA2S",
	product: "IA2S Cast",
	legalName: "IA2S Soluções e Sistemas Ltda.",
	cnpj: "65.840.082/0001-28",
	address: "Goiânia/GO",
	site: "https://ia2s.com.br",
};

export const CONTACT = {
	email: "suporte@ia2s.com.br",
	/** Encarregado de dados (LGPD). */
	privacyEmail: "suporte@ia2s.com.br",
	/** Link wa.me com DDI+DDD+número; null esconde o WhatsApp. */
	whatsappUrl: null as string | null,
};

export const TRIAL = { days: 7, maxPosts: 20, storageGb: 2 };

/** Data da última revisão dos Termos e da Política (mostrada no topo das páginas). */
export const LEGAL_UPDATED_AT = "12 de novembro de 2026";
