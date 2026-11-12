import { Mail, MessageCircle, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { COMPANY, CONTACT } from "@/lib/site";

export const metadata: Metadata = {
	title: "Contato",
	description: "Fale com a IA2S sobre o Cast: planos, suporte e privacidade.",
};

export default function ContactPage() {
	const channels = [
		{
			icon: Mail,
			title: "Planos e suporte",
			text: "Para continuar depois do teste, tirar dúvidas ou relatar um problema.",
			href: `mailto:${CONTACT.email}`,
			label: CONTACT.email,
		},
		...(CONTACT.whatsappUrl
			? [
					{
						icon: MessageCircle,
						title: "WhatsApp",
						text: "Para conversar direto com a equipe.",
						href: CONTACT.whatsappUrl,
						label: "Abrir conversa",
					},
				]
			: []),
		{
			icon: ShieldCheck,
			title: "Privacidade e dados",
			text: "Pedidos sobre seus dados pessoais (LGPD), com o encarregado.",
			href: `mailto:${CONTACT.privacyEmail}`,
			label: CONTACT.privacyEmail,
		},
	];

	return (
		<div className="mx-auto w-full max-w-4xl px-4 py-14 md:px-8 md:py-20">
			<p className="eyebrow">Contato</p>
			<h1 className="font-display mt-4 text-4xl font-light md:text-5xl">
				Fale com a IA2S
			</h1>
			<p className="text-muted-foreground mt-4 max-w-xl text-lg">
				Escolha o canal certo para o seu assunto.
			</p>
			<ul className="mt-10 grid gap-4 sm:grid-cols-2">
				{channels.map((c) => (
					<li key={c.title} className="bg-card rounded-2xl border p-6">
						<c.icon className="text-gold-ink size-5" aria-hidden />
						<h2 className="mt-4 font-semibold">{c.title}</h2>
						<p className="text-muted-foreground mt-1.5 text-sm">{c.text}</p>
						<a
							href={c.href}
							target={c.href.startsWith("http") ? "_blank" : undefined}
							rel="noreferrer"
							className="text-foreground mt-4 inline-block text-sm font-medium underline"
						>
							{c.label}
						</a>
					</li>
				))}
			</ul>
			<div className="text-muted-foreground mt-12 border-t pt-6 text-sm">
				<p className="text-foreground font-medium">{COMPANY.legalName}</p>
				<p>CNPJ {COMPANY.cnpj}</p>
				<p>{COMPANY.address}</p>
			</div>
		</div>
	);
}
