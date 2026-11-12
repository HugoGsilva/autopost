import { listProviderInfo } from "@autopost/social";
import { Button } from "@autopost/ui/components/button";
import {
	CalendarClock,
	Check,
	ListChecks,
	MessageSquareText,
	ShieldCheck,
	Upload,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PlatformBadge } from "@/components/platform-icon";
import { CONTACT, TRIAL } from "@/lib/site";

export const metadata: Metadata = {
	title: { absolute: "IA2S Cast · Um vídeo, todas as redes" },
	description:
		"Envie um vídeo uma vez e publique no Instagram, TikTok, YouTube, LinkedIn e outras redes, na hora ou agendado.",
};

const steps = [
	{
		icon: Upload,
		title: "Envie o vídeo",
		text: "Arraste o arquivo (MP4, MOV ou WebM). O Cast confere formato, duração e tamanho para cada rede antes de você publicar.",
	},
	{
		icon: ListChecks,
		title: "Escolha onde publicar",
		text: "Marque as contas conectadas. Ajuste a legenda e as opções de cada rede, como privacidade no TikTok ou título no YouTube.",
	},
	{
		icon: CalendarClock,
		title: "Publique ou agende",
		text: "Publique na hora ou escolha data e horário. O Cast envia para cada rede e mostra o resultado de cada uma.",
	},
];

const features = [
	{
		icon: MessageSquareText,
		title: "Legenda por rede",
		text: "Uma legenda geral, com a opção de personalizar o texto para cada destino e ver o limite de caracteres de cada rede.",
	},
	{
		icon: CalendarClock,
		title: "Agenda visual",
		text: "Veja os posts da semana e do mês num calendário e arraste para remarcar.",
	},
	{
		icon: ShieldCheck,
		title: "Você no controle",
		text: "Nada sai sem você mandar. Conexões com as redes usam o login oficial de cada uma, e você pode desconectar quando quiser.",
	},
];

const NETWORKS = [
	"instagram",
	"tiktok",
	"youtube",
	"facebook",
	"linkedin",
	"threads",
	"x",
	"pinterest",
	"bluesky",
	"telegram",
	"discord",
];

export default function Home() {
	const networks = listProviderInfo()
		.filter((p) => NETWORKS.includes(p.id))
		.sort((a, b) => NETWORKS.indexOf(a.id) - NETWORKS.indexOf(b.id));

	return (
		<>
			<section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 md:px-8 md:pt-24">
				<p className="eyebrow">IA2S · Cast</p>
				<h1 className="font-display mt-5 max-w-3xl text-5xl leading-[1.02] font-light md:text-7xl">
					Um vídeo.
					<br />
					<span className="text-gold-ink italic">Todas as redes.</span>
				</h1>
				<p className="text-muted-foreground mt-6 max-w-xl text-lg">
					Envie uma vez, escolha onde e quando. O Cast publica o seu vídeo no
					Instagram, TikTok, YouTube, LinkedIn e outras redes, sem você precisar
					abrir cada aplicativo.
				</p>
				<div className="mt-8 flex flex-wrap gap-3">
					<Button
						size="lg"
						render={
							<Link
								href={{ pathname: "/login", query: { modo: "cadastro" } }}
							/>
						}
						nativeButton={false}
						className="glow-gold h-12 px-6 font-semibold"
					>
						Testar grátis por {TRIAL.days} dias
					</Button>
					<Button
						size="lg"
						variant="outline"
						render={<a href="#como-funciona" />}
						nativeButton={false}
						className="h-12 px-6"
					>
						Ver como funciona
					</Button>
				</div>
				<p className="text-muted-foreground mt-4 text-sm">
					Sem cartão de crédito.
				</p>
			</section>

			<section
				id="redes"
				className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pb-20 md:px-8"
			>
				<h2 className="text-muted-foreground text-sm font-semibold">
					Redes suportadas
				</h2>
				<ul className="mt-4 flex flex-wrap gap-3">
					{networks.map((p) => (
						<li
							key={p.id}
							className="bg-card flex items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5 text-sm font-medium"
						>
							<PlatformBadge
								platform={p.id}
								color={p.brandColor}
								size="sm"
								className="rounded-full"
							/>
							{p.name}
						</li>
					))}
				</ul>
			</section>

			<section
				id="como-funciona"
				className="bg-card/60 scroll-mt-20 border-y py-20"
			>
				<div className="mx-auto w-full max-w-6xl px-4 md:px-8">
					<p className="eyebrow">Como funciona</p>
					<h2 className="font-display mt-3 text-4xl font-light">
						Três passos, do arquivo ao post
					</h2>
					<ol className="mt-10 grid gap-6 md:grid-cols-3">
						{steps.map((s, i) => (
							<li key={s.title} className="bg-background rounded-2xl border p-6">
								<div className="flex items-center gap-3">
									<span className="bg-gold/15 text-gold-ink nums flex size-9 items-center justify-center rounded-full text-sm font-semibold">
										{i + 1}
									</span>
									<s.icon className="text-gold-ink size-5" aria-hidden />
								</div>
								<h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
								<p className="text-muted-foreground mt-2">{s.text}</p>
							</li>
						))}
					</ol>
					<div className="mt-14 grid gap-8 md:grid-cols-3">
						{features.map((f) => (
							<div key={f.title}>
								<f.icon className="text-gold-ink size-5" aria-hidden />
								<h3 className="mt-3 font-semibold">{f.title}</h3>
								<p className="text-muted-foreground mt-1.5 text-sm">{f.text}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<section
				id="planos"
				className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 md:px-8"
			>
				<p className="eyebrow">Planos</p>
				<h2 className="font-display mt-3 text-4xl font-light">
					Comece grátis. Continue com a gente.
				</h2>
				<div className="mt-10 grid gap-6 md:grid-cols-2">
					<div className="bg-card rounded-2xl border p-7">
						<h3 className="text-lg font-semibold">Teste grátis</h3>
						<p className="font-display mt-2 text-4xl">
							{TRIAL.days} dias{" "}
							<span className="text-muted-foreground text-base">sem custo</span>
						</p>
						<ul className="mt-6 space-y-2.5 text-sm">
							{[
								"Todas as redes suportadas",
								`Até ${TRIAL.maxPosts} publicações`,
								`${TRIAL.storageGb} GB para vídeos`,
								"Agenda e publicação na hora",
							].map((item) => (
								<li key={item} className="flex gap-2">
									<Check className="text-gold-ink mt-0.5 size-4 shrink-0" />
									{item}
								</li>
							))}
						</ul>
						<Button
							render={
								<Link
									href={{ pathname: "/login", query: { modo: "cadastro" } }}
								/>
							}
							nativeButton={false}
							className="glow-gold mt-8 w-full font-semibold"
						>
							Criar conta grátis
						</Button>
					</div>
					<div className="rounded-2xl border p-7">
						<h3 className="text-lg font-semibold">Para continuar</h3>
						<p className="font-display mt-2 text-4xl">Sob medida</p>
						<p className="text-muted-foreground mt-6 text-sm">
							Gostou do teste? Fale com a IA2S. Montamos um plano de acordo com
							o número de contas e de publicações da sua empresa, e liberamos o
							acesso na mesma conta, sem perder nada do que você já configurou.
						</p>
						<Button
							variant="outline"
							render={<Link href="/contato" />}
							nativeButton={false}
							className="mt-8 w-full"
						>
							Falar com a IA2S
						</Button>
						<p className="text-muted-foreground mt-3 text-center text-xs">
							ou escreva para{" "}
							<a href={`mailto:${CONTACT.email}`} className="underline">
								{CONTACT.email}
							</a>
						</p>
					</div>
				</div>
			</section>

			<section className="bg-card/60 border-t py-20">
				<div className="mx-auto w-full max-w-3xl px-4 md:px-8">
					<p className="eyebrow">Dúvidas</p>
					<h2 className="font-display mt-3 text-4xl font-light">
						Perguntas frequentes
					</h2>
					<dl className="mt-10 space-y-8">
						<div>
							<dt className="font-semibold">
								O Cast publica sem a minha autorização?
							</dt>
							<dd className="text-muted-foreground mt-1.5">
								Não. Você conecta cada conta pelo login oficial da rede, e só
								sai o que você mandar publicar ou agendar. Dá para cancelar um
								agendamento a qualquer momento.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">
								O que acontece quando o teste acaba?
							</dt>
							<dd className="text-muted-foreground mt-1.5">
								Você continua vendo suas publicações, mas não consegue publicar
								nem agendar até falar com a IA2S. Se preferir, exclua a conta
								pelo menu do perfil e apagamos seus dados.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Meus vídeos ficam guardados?</dt>
							<dd className="text-muted-foreground mt-1.5">
								Só pelo tempo necessário para publicar. Os arquivos são apagados
								automaticamente depois. Os detalhes estão na{" "}
								<Link href="/privacidade" className="underline">
									Política de Privacidade
								</Link>
								.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">
								Posso desconectar uma rede depois?
							</dt>
							<dd className="text-muted-foreground mt-1.5">
								Sim, em Contas, a qualquer momento. Você também pode revogar o
								acesso pelas configurações da própria rede.
							</dd>
						</div>
					</dl>
				</div>
			</section>
		</>
	);
}
