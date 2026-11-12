import { Clock, Lock } from "lucide-react";

import { CONTACT } from "@/lib/site";

/** Faixa do teste grátis: dias restantes ou, se acabou, como continuar. */
export function TrialBanner({ accessUntil }: { accessUntil: string | null }) {
	if (!accessUntil) return null;
	const msLeft = new Date(accessUntil).getTime() - Date.now();
	const expired = msLeft <= 0;
	const days = Math.max(1, Math.ceil(msLeft / 86_400_000));
	return (
		<div
			role={expired ? "alert" : "status"}
			data-testid="trial-banner"
			className={
				expired
					? "border-destructive/30 bg-destructive/10 flex items-start gap-3 border-b px-4 py-3 text-sm md:px-8"
					: "bg-gold/10 border-gold/20 flex items-start gap-3 border-b px-4 py-3 text-sm md:px-8"
			}
		>
			{expired ? (
				<Lock className="text-destructive mt-0.5 size-4 shrink-0" />
			) : (
				<Clock className="text-gold-ink mt-0.5 size-4 shrink-0" />
			)}
			<p>
				<span className="font-semibold">
					{expired
						? "Seu teste grátis terminou."
						: `Teste grátis: ${days === 1 ? "último dia" : `${days} dias restantes`}.`}
				</span>{" "}
				{expired
					? "Você ainda vê suas publicações, mas não pode publicar nem agendar."
					: "Para continuar depois do teste,"}{" "}
				fale com a IA2S
				{CONTACT.whatsappUrl && (
					<>
						{" "}
						pelo{" "}
						<a
							href={CONTACT.whatsappUrl}
							target="_blank"
							rel="noreferrer"
							className="underline"
						>
							WhatsApp
						</a>{" "}
						ou
					</>
				)}{" "}
				em{" "}
				<a href={`mailto:${CONTACT.email}`} className="underline">
					{CONTACT.email}
				</a>
				.
			</p>
		</div>
	);
}
