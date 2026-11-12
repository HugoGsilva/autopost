import { LEGAL_UPDATED_AT } from "@/lib/site";

/** Página de texto longo (Termos, Privacidade): coluna estreita e tipografia de leitura. */
export function LegalPage({
	title,
	intro,
	children,
}: {
	title: string;
	intro: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<article className="mx-auto w-full max-w-3xl px-4 py-14 md:px-8 md:py-20">
			<p className="eyebrow">IA2S · Cast</p>
			<h1 className="font-display mt-4 text-4xl font-light md:text-5xl">
				{title}
			</h1>
			<p className="text-muted-foreground mt-3 text-sm">
				Última atualização: {LEGAL_UPDATED_AT}
			</p>
			<div className="text-muted-foreground mt-8 space-y-4 text-base leading-relaxed">
				{intro}
			</div>
			<div className="mt-10 space-y-10">{children}</div>
		</article>
	);
}

export function LegalSection({
	id,
	title,
	children,
}: {
	id: string;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section id={id} className="scroll-mt-20">
			<h2 className="text-xl font-semibold">{title}</h2>
			<div className="text-muted-foreground mt-3 space-y-3 leading-relaxed [&_a]:text-foreground [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground [&_ul]:space-y-1.5">
				{children}
			</div>
		</section>
	);
}
