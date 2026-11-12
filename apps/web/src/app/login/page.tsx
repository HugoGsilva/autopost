import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ modo?: string }>;
}) {
	const session = await getSession();
	if (session?.user) redirect("/painel");
	const { modo } = await searchParams;

	return (
		<div className="bg-background grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
			<section className="relative hidden overflow-hidden border-r lg:flex lg:flex-col lg:justify-between lg:p-12">
				<div
					className="pointer-events-none absolute inset-0 flex items-center justify-center"
					aria-hidden
				>
					<div className="border-gold/15 aspect-square w-[min(80vh,90%)] rounded-full border" />
					<div className="border-gold/20 absolute aspect-square w-[min(58vh,66%)] rounded-full border" />
					<div className="border-gold/30 absolute aspect-square w-[min(36vh,42%)] rounded-full border" />
					<div className="bg-gold/15 absolute size-72 rounded-full blur-3xl" />
				</div>
				<p className="eyebrow relative">IA2S · Cast</p>
				<div className="relative space-y-5">
					<h1 className="font-display text-6xl leading-[1.02] font-light">
						Um vídeo.
						<br />
						<span className="text-gold-ink italic">Todas as redes.</span>
					</h1>
					<p className="text-muted-foreground max-w-md text-lg">
						Envie uma vez, escolha onde e quando. O Cast publica no Instagram,
						TikTok, YouTube, LinkedIn e onde mais você precisar.
					</p>
				</div>
				<p className="font-display text-gold-ink relative italic">
					Tecnologia com alma.
				</p>
			</section>
			<section className="flex items-center justify-center px-4 py-12">
				<LoginForm initialMode={modo === "cadastro" ? "signup" : "login"} />
			</section>
		</div>
	);
}
