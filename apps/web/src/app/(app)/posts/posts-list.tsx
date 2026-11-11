"use client";

import { Button } from "@autopost/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@autopost/ui/components/empty";
import { Skeleton } from "@autopost/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@autopost/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { ListVideo } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { QueryError } from "@/components/page";
import { PostCard } from "@/components/post-card";
import { orpc } from "@/utils/orpc";

const filters = [
	{ value: "all", label: "Todas" },
	{ value: "scheduled", label: "Agendadas" },
	{ value: "publishing", label: "Publicando" },
	{ value: "published", label: "Publicadas" },
	{ value: "failed", label: "Com falha" },
] as const;

type Filter = (typeof filters)[number]["value"];

export function PostsList() {
	const params = useSearchParams();
	const router = useRouter();
	const highlight = params.get("destaque");
	const initial =
		filters.find((f) => f.value === params.get("status"))?.value ?? "all";
	const [filter, setFilterState] = useState<Filter>(initial);
	const setFilter = (f: Filter) => {
		setFilterState(f);
		router.replace(f === "all" ? "/posts" : `/posts?status=${f}`, {
			scroll: false,
		});
	};
	const posts = useQuery({
		...orpc.posts.list.queryOptions({ input: { limit: 200 } }),
		// Atualiza sozinho enquanto houver algo publicando ou prestes a sair.
		refetchInterval: (q) =>
			q.state.data?.some(
				(p) =>
					p.status === "publishing" ||
					(p.status === "scheduled" &&
						new Date(p.scheduledAt).getTime() - Date.now() < 2 * 60_000),
			)
				? 2500
				: 30_000,
	});

	const visible = (posts.data ?? []).filter((p) => {
		if (filter === "all") return true;
		if (filter === "failed")
			return p.status === "failed" || p.status === "partial";
		if (filter === "published")
			return p.status === "published" || p.status === "partial";
		return p.status === filter;
	});

	return (
		<div className="space-y-5">
			<Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
				<TabsList className="h-auto max-w-full [scrollbar-width:none] justify-start overflow-x-auto [mask-image:linear-gradient(to_right,black_85%,transparent)] sm:[mask-image:none]">
					{filters.map((f) => (
						<TabsTrigger key={f.value} value={f.value}>
							{f.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>

			{posts.isError && (
				<QueryError error={posts.error} onRetry={() => posts.refetch()} />
			)}
			{posts.isPending && (
				<div className="space-y-3">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-32 rounded-2xl" />
					))}
				</div>
			)}
			{posts.isSuccess && visible.length === 0 && (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<ListVideo />
						</EmptyMedia>
						<EmptyTitle>
							{filter === "all" ? "Nenhuma publicação ainda" : "Nada por aqui"}
						</EmptyTitle>
						<EmptyDescription>
							{filter === "all"
								? "Crie o primeiro post e acompanhe o status aqui."
								: "Nenhum post com esse status."}
						</EmptyDescription>
					</EmptyHeader>
					{filter === "all" && (
						<EmptyContent>
							<Button render={<Link href="/novo" />} nativeButton={false}>
								Criar post
							</Button>
						</EmptyContent>
					)}
				</Empty>
			)}
			<div className="space-y-3">
				{visible.map((p) => (
					<PostCard key={p.id} post={p} highlight={p.id === highlight} />
				))}
			</div>
		</div>
	);
}
