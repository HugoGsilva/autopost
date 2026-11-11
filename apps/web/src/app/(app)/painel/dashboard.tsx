"use client";

import { Button } from "@autopost/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@autopost/ui/components/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@autopost/ui/components/empty";
import { Skeleton } from "@autopost/ui/components/skeleton";
import { cn } from "@autopost/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Circle, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { PageHeader, QueryError } from "@/components/page";
import { PostRow } from "@/components/post-card";
import { orpc } from "@/utils/orpc";

function greeting() {
	const h = new Date().getHours();
	return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function Dashboard({
	name,
	isAdmin,
}: {
	name: string;
	isAdmin: boolean;
}) {
	const stats = useQuery({
		...orpc.posts.stats.queryOptions(),
		refetchInterval: 15_000,
	});
	const platforms = useQuery(orpc.platforms.list.queryOptions());
	const posts = useQuery({
		...orpc.posts.list.queryOptions({ input: { limit: 30 } }),
		refetchInterval: (q) =>
			q.state.data?.some((p) => p.status === "publishing") ? 2500 : 15_000,
	});

	const upcoming = (posts.data ?? [])
		.filter((p) => p.status === "scheduled")
		.sort(
			(a, b) =>
				new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
		)
		.slice(0, 4);
	const recent = (posts.data ?? [])
		.filter((p) => p.status !== "scheduled")
		.slice(0, 4);

	const configuredOauth =
		platforms.data?.platforms.filter((p) => p.auth === "oauth" && p.configured)
			.length ?? 0;
	const steps: {
		done: boolean;
		label: string;
		href: Route;
		adminOnly?: boolean;
	}[] = [
		{
			done: configuredOauth > 0,
			label: "Configurar as chaves das redes (uma vez)",
			href: "/configuracoes",
			adminOnly: true,
		},
		{
			done: (stats.data?.accounts ?? 0) > 0,
			label: "Conectar as contas da empresa",
			href: "/contas",
		},
		{
			done: (posts.data?.length ?? 0) > 0,
			label: "Enviar o primeiro vídeo",
			href: "/novo",
		},
	];
	const visibleSteps = steps.filter((s) => !s.adminOnly || isAdmin);
	const onboarding =
		stats.isSuccess && posts.isSuccess && visibleSteps.some((s) => !s.done);

	return (
		<>
			<PageHeader
				eyebrow={greeting()}
				title={`Olá, ${name}`}
				description="Acompanhe o que está agendado e o que já saiu."
				actions={
					<Button
						render={<Link href="/novo" />}
						nativeButton={false}
						size="lg"
						className="glow-gold h-11 font-semibold"
					>
						<Plus /> Novo post
					</Button>
				}
			/>

			{stats.isError && (
				<QueryError error={stats.error} onRetry={() => stats.refetch()} />
			)}
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Stat label="Agendados" value={stats.data?.scheduled} href="/agenda" />
				<Stat
					label="Publicados (7 dias)"
					value={stats.data?.published7d}
					href="/posts"
				/>
				<Stat
					label="Com falha (7 dias)"
					value={stats.data?.failed7d}
					href={"/posts?status=failed" as Route}
					tone={stats.data?.failed7d ? "bad" : undefined}
				/>
				<Stat
					label="Contas conectadas"
					value={stats.data?.accounts}
					href="/contas"
				/>
			</div>

			{onboarding && (
				<Card className="border-gold/40 bg-accent/20 mt-6">
					<CardHeader>
						<CardTitle className="font-display text-xl font-normal">
							Primeiros passos
						</CardTitle>
						<CardDescription>
							Três etapas e você já publica em todas as redes de uma vez.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						{visibleSteps.map((s) => (
							<Link
								key={s.label}
								href={s.href}
								className="hover:bg-accent/50 flex items-center gap-3 rounded-xl px-3 py-2 transition-colors"
							>
								{s.done ? (
									<CheckCircle2 className="text-success size-5" />
								) : (
									<Circle className="text-gold-ink size-5" />
								)}
								<span
									className={cn(
										"flex-1",
										s.done && "text-muted-foreground line-through",
									)}
								>
									{s.label}
								</span>
								{!s.done && (
									<ArrowRight className="text-muted-foreground size-4" />
								)}
							</Link>
						))}
					</CardContent>
				</Card>
			)}

			<div className="mt-8 grid gap-8 lg:grid-cols-2">
				<Section title="Próximos" href="/agenda" loading={posts.isPending}>
					{upcoming.length === 0 ? (
						<EmptyState
							title="Nada agendado"
							text="Agende um post e ele aparece aqui."
						/>
					) : (
						upcoming.map((p) => <PostRow key={p.id} post={p} />)
					)}
				</Section>
				<Section
					title="Atividade recente"
					href="/posts"
					loading={posts.isPending}
				>
					{recent.length === 0 ? (
						<EmptyState
							title="Sem atividade ainda"
							text="As publicações concluídas aparecem aqui."
						/>
					) : (
						recent.map((p) => <PostRow key={p.id} post={p} />)
					)}
				</Section>
			</div>
		</>
	);
}

function Stat({
	label,
	value,
	href,
	tone,
}: {
	label: string;
	value?: number;
	href: Route;
	tone?: "bad";
}) {
	return (
		<Link href={href}>
			<Card className="hover:border-gold/50 gap-1 p-4 transition-colors">
				<p className="text-muted-foreground text-xs">{label}</p>
				{value === undefined ? (
					<Skeleton className="mt-1 h-9 w-12" />
				) : (
					<p
						className={cn(
							"nums font-sans text-4xl font-semibold tracking-tight",
							tone === "bad" ? "text-destructive" : "text-foreground",
						)}
					>
						{value}
					</p>
				)}
			</Card>
		</Link>
	);
}

function Section({
	title,
	href,
	loading,
	children,
}: {
	title: string;
	href: Route;
	loading: boolean;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-3">
			<div className="flex items-baseline justify-between">
				<h2 className="font-display text-2xl">{title}</h2>
				<Link href={href} className="text-gold-ink text-sm hover:underline">
					Ver tudo
				</Link>
			</div>
			{loading ? (
				<div className="space-y-3">
					<Skeleton className="h-28 rounded-2xl" />
					<Skeleton className="h-28 rounded-2xl" />
				</div>
			) : (
				children
			)}
		</section>
	);
}

function EmptyState({ title, text }: { title: string; text: string }) {
	return (
		<Empty className="border py-10">
			<EmptyHeader>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{text}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
