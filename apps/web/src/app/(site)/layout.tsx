import { Button } from "@autopost/ui/components/button";
import Link from "next/link";

import { BrandMark } from "@/components/brand";
import { COMPANY, CONTACT } from "@/lib/site";

/** Site público: home, contato, Termos e Privacidade (abertos sem login). */
export default function SiteLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="bg-aura flex min-h-svh flex-col">
			<header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
				<div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
					<Link href="/" aria-label="IA2S Cast, página inicial">
						<BrandMark />
					</Link>
					<nav className="flex items-center gap-1 text-sm md:gap-2">
						<a
							href="/#como-funciona"
							className="text-muted-foreground hover:text-foreground hidden rounded-full px-3 py-2 md:inline"
						>
							Como funciona
						</a>
						<a
							href="/#planos"
							className="text-muted-foreground hover:text-foreground hidden rounded-full px-3 py-2 md:inline"
						>
							Planos
						</a>
						<Link
							href="/contato"
							className="text-muted-foreground hover:text-foreground hidden rounded-full px-3 py-2 sm:inline"
						>
							Contato
						</Link>
						<Button
							variant="ghost"
							render={<Link href="/login" />}
							nativeButton={false}
						>
							Entrar
						</Button>
						<Button
							render={
								<Link
									href={{ pathname: "/login", query: { modo: "cadastro" } }}
								/>
							}
							nativeButton={false}
							className="glow-gold font-semibold"
						>
							Testar grátis
						</Button>
					</nav>
				</div>
			</header>

			<main className="flex-1">{children}</main>

			<footer className="border-t">
				<div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 text-sm md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
					<div className="space-y-3">
						<BrandMark />
						<p className="text-muted-foreground max-w-sm">
							Publique o mesmo vídeo no Instagram, TikTok, YouTube e outras
							redes de uma vez, na hora ou agendado.
						</p>
					</div>
					<div className="space-y-2">
						<p className="font-semibold">Produto</p>
						<ul className="text-muted-foreground space-y-1.5">
							<li>
								<a href="/#como-funciona" className="hover:text-foreground">
									Como funciona
								</a>
							</li>
							<li>
								<a href="/#redes" className="hover:text-foreground">
									Redes suportadas
								</a>
							</li>
							<li>
								<a href="/#planos" className="hover:text-foreground">
									Planos
								</a>
							</li>
							<li>
								<Link href="/contato" className="hover:text-foreground">
									Contato
								</Link>
							</li>
						</ul>
					</div>
					<div className="space-y-2">
						<p className="font-semibold">Legal</p>
						<ul className="text-muted-foreground space-y-1.5">
							<li>
								<Link href="/termos" className="hover:text-foreground">
									Termos de Uso
								</Link>
							</li>
							<li>
								<Link href="/privacidade" className="hover:text-foreground">
									Política de Privacidade
								</Link>
							</li>
							<li>
								<a
									href={`mailto:${CONTACT.email}`}
									className="hover:text-foreground"
								>
									{CONTACT.email}
								</a>
							</li>
						</ul>
					</div>
				</div>
				<div className="text-muted-foreground mx-auto w-full max-w-6xl border-t px-4 py-5 text-xs md:px-8">
					© {new Date().getFullYear()} {COMPANY.legalName} · CNPJ{" "}
					{COMPANY.cnpj}. {COMPANY.product} é um produto da {COMPANY.brand}.
				</div>
			</footer>
		</div>
	);
}
