"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@autopost/ui/components/alert-dialog";
import { Button } from "@autopost/ui/components/button";
import { Card } from "@autopost/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@autopost/ui/components/dropdown-menu";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@autopost/ui/components/popover";
import { cn } from "@autopost/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Ban,
	Clock,
	Copy,
	ExternalLink,
	Info,
	Link2,
	MoreHorizontal,
	Pencil,
	RefreshCw,
	RotateCcw,
	Trash2,
	Zap,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { errorMessage, formatWhen, fromNow } from "@/lib/format";
import type { PostItem, TargetItem } from "@/lib/types";
import { orpc } from "@/utils/orpc";

import { EditPostDialog } from "./edit-post-dialog";
import { displayStatus, StatusBadge, StatusIcon } from "./page";
import { PlatformIcon } from "./platform-icon";

export function usePostActions() {
	const qc = useQueryClient();
	const refresh = () => qc.invalidateQueries({ queryKey: orpc.posts.key() });
	const opts = (msg: string) => ({
		onSuccess: () => {
			toast.success(msg);
			refresh();
		},
		onError: (e: unknown) => toast.error(errorMessage(e)),
	});
	return {
		publishNow: useMutation(
			orpc.posts.publishNow.mutationOptions(opts("Enviando agora")),
		),
		cancel: useMutation(
			orpc.posts.cancel.mutationOptions(opts("Post cancelado")),
		),
		remove: useMutation(
			orpc.posts.remove.mutationOptions(opts("Post excluído")),
		),
		retry: useMutation(
			orpc.posts.retryTarget.mutationOptions(opts("Nova tentativa na fila")),
		),
		reschedule: useMutation(
			orpc.posts.reschedule.mutationOptions(opts("Post remarcado")),
		),
		cancelTarget: useMutation(
			orpc.posts.cancelTarget.mutationOptions(opts("Destino removido")),
		),
	};
}

export function reuseHref(post: PostItem): Route {
	const q = new URLSearchParams();
	if (post.media) q.set("video", post.media.id);
	if (post.caption) q.set("legenda", post.caption);
	return `/novo?${q}` as Route;
}

export function PostCard({
	post,
	highlight,
}: {
	post: PostItem;
	highlight?: boolean;
}) {
	const actions = usePostActions();
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [editing, setEditing] = useState(false);
	const vertical = (post.media?.height ?? 0) > (post.media?.width ?? 0);
	const done = post.targets.filter((t) => t.status === "published").length;
	const failed = post.targets.filter((t) => t.status === "failed");
	const shown = displayStatus(post.status, post.scheduledAt);
	const editable = post.status === "scheduled";

	return (
		<Card
			className={cn("gap-3 p-3 sm:p-4", highlight && "ring-gold ring-2")}
			data-testid={`post-${post.id}`}
			data-status={post.status}
		>
			<div className="flex gap-3 sm:gap-4">
				<div
					className={cn(
						"relative shrink-0 overflow-hidden rounded-lg bg-black",
						vertical
							? "h-28 w-16 sm:h-32 sm:w-18"
							: "h-16 w-28 sm:h-24 sm:w-40",
					)}
				>
					{post.media ? (
						<video
							src={`${post.media.url}#t=0.5`}
							preload="metadata"
							muted
							playsInline
							className="size-full object-cover"
						/>
					) : (
						<div className="flex size-full items-center justify-center p-1 text-center text-[0.6rem] text-white/50">
							vídeo removido
						</div>
					)}
				</div>

				<div className="min-w-0 flex-1 space-y-2">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<StatusBadge status={shown} />
						<span className="text-muted-foreground flex items-center gap-1 text-xs">
							<Clock className="size-3" />
							{formatWhen(post.scheduledAt)}
							{post.status === "scheduled" && shown === "scheduled" && (
								<span>· {fromNow(post.scheduledAt)}</span>
							)}
						</span>
						{post.targets.length > 1 && (
							<span className="nums text-muted-foreground text-xs">
								{done}/{post.targets.length} publicados
							</span>
						)}
					</div>
					<p className="line-clamp-2 text-sm break-words">
						{post.caption || (
							<span className="text-muted-foreground italic">Sem legenda</span>
						)}
					</p>
					<div className="flex flex-wrap gap-1.5">
						{post.targets.map((t) => (
							<TargetPill
								key={t.id}
								target={t}
								post={post}
								onRetry={() => actions.retry.mutate({ targetId: t.id })}
								onCancel={() => actions.cancelTarget.mutate({ targetId: t.id })}
							/>
						))}
					</div>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								variant="ghost"
								size="icon"
								aria-label="Ações do post"
								className="-mt-1 -mr-1 shrink-0"
							/>
						}
					>
						<MoreHorizontal />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-52">
						{editable && (
							<DropdownMenuItem onClick={() => setEditing(true)}>
								<Pencil /> Editar texto e horário
							</DropdownMenuItem>
						)}
						{editable && (
							<DropdownMenuItem
								onClick={() => actions.publishNow.mutate({ id: post.id })}
							>
								<Zap /> Publicar agora
							</DropdownMenuItem>
						)}
						{post.media && (
							<DropdownMenuItem render={<Link href={reuseHref(post)} />}>
								<Copy /> Usar este vídeo de novo
							</DropdownMenuItem>
						)}
						{(post.status === "scheduled" || post.status === "publishing") && (
							<DropdownMenuItem
								onClick={() => actions.cancel.mutate({ id: post.id })}
							>
								<Ban /> Cancelar o que não saiu
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							disabled={post.status === "publishing"}
							onClick={() => setConfirmDelete(true)}
						>
							<Trash2 /> Excluir
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{failed.length > 0 && (
				<FailureBox
					targets={failed}
					onRetry={() => {
						for (const t of failed) actions.retry.mutate({ targetId: t.id });
					}}
					post={post}
				/>
			)}
			{post.targets
				.filter((t) => t.note)
				.map((t) => (
					<p
						key={t.id}
						className="bg-warning/10 text-warning flex gap-2 rounded-lg px-3 py-2 text-xs"
					>
						<Info className="mt-0.5 size-3.5 shrink-0" />
						<span>
							<b>{t.accountName}:</b> {t.note}
						</span>
					</p>
				))}

			<EditPostDialog post={post} open={editing} onOpenChange={setEditing} />

			<AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir este post?</AlertDialogTitle>
						<AlertDialogDescription>
							Remove do Cast e cancela o que ainda não saiu. O que já foi
							publicado continua nas redes.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Voltar</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => actions.remove.mutate({ id: post.id })}
						>
							Excluir
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}

/** Falhas explicadas em linguagem simples, com o botão certo para resolver. */
function FailureBox({
	targets,
	post,
	onRetry,
}: {
	targets: TargetItem[];
	post: PostItem;
	onRetry: () => void;
}) {
	const needsReconnect = targets.some(
		(t) => t.errorInfo?.action === "reconnect",
	);
	const needsVideo = targets.some(
		(t) => t.errorInfo?.action === "replace-video",
	);
	return (
		<div
			className="border-destructive/30 bg-destructive/5 space-y-2 rounded-xl border p-3"
			data-testid="failure-box"
		>
			{targets.map((t) => (
				<p key={t.id} className="text-sm">
					<span className="text-destructive font-semibold">
						{t.accountName}:
					</span>{" "}
					{t.errorInfo?.message ?? t.error}
				</p>
			))}
			<div className="flex flex-wrap gap-2">
				{needsReconnect && (
					<Button
						size="sm"
						render={<Link href="/contas" />}
						nativeButton={false}
					>
						<Link2 /> Reconectar conta
					</Button>
				)}
				{needsVideo && (
					<Button
						size="sm"
						variant="outline"
						render={<Link href="/novo" />}
						nativeButton={false}
					>
						<RefreshCw /> Enviar outro vídeo
					</Button>
				)}
				<Button
					size="sm"
					variant={needsReconnect || needsVideo ? "outline" : "default"}
					onClick={onRetry}
				>
					<RotateCcw /> Tentar de novo
				</Button>
				{post.media && !needsVideo && (
					<Button
						size="sm"
						variant="ghost"
						render={<Link href={reuseHref(post)} />}
						nativeButton={false}
					>
						<Copy /> Usar este vídeo de novo
					</Button>
				)}
			</div>
		</div>
	);
}

function TargetPill({
	target,
	post,
	onRetry,
	onCancel,
}: {
	target: TargetItem;
	post: PostItem;
	onRetry: () => void;
	onCancel: () => void;
}) {
	const status =
		target.status === "pending"
			? displayStatus("pending", target.runAt)
			: target.status;
	return (
		<Popover>
			<PopoverTrigger
				render={
					<button
						type="button"
						className={cn(
							"bg-background/50 hover:border-gold/60 inline-flex min-h-8 items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-2 text-xs transition-colors",
							target.status === "failed" && "border-destructive/40",
						)}
						data-testid={`target-${target.id}`}
						data-status={target.status}
					/>
				}
			>
				<PlatformIcon platform={target.platform} className="size-3" />
				<span className="max-w-28 truncate">{target.accountName}</span>
				<StatusIcon status={status} className="size-3" />
			</PopoverTrigger>
			<PopoverContent className="w-72 space-y-3" align="start">
				<div className="flex items-center gap-2">
					<PlatformIcon platform={target.platform} />
					<p className="min-w-0 flex-1 truncate text-sm font-medium">
						{target.accountName}
					</p>
					<StatusBadge status={status} />
				</div>
				{target.status === "published" && (
					<p className="text-muted-foreground text-xs">
						Publicado {target.publishedAt ? formatWhen(target.publishedAt) : ""}
					</p>
				)}
				{target.errorInfo && (
					<div className="space-y-1">
						<p className="text-sm">{target.errorInfo.message}</p>
						<details className="text-muted-foreground text-xs">
							<summary className="cursor-pointer">Detalhes técnicos</summary>
							<p className="mt-1 font-mono break-words">
								{target.errorInfo.detail}
							</p>
						</details>
					</div>
				)}
				{target.note && <p className="text-warning text-xs">{target.note}</p>}
				{target.caption && (
					<p className="bg-muted line-clamp-3 rounded-md p-2 text-xs">
						<span className="font-semibold">Legenda própria:</span>{" "}
						{target.caption}
					</p>
				)}
				<div className="flex flex-wrap gap-2">
					{target.status === "published" && target.externalUrl && (
						<Button
							size="sm"
							render={
								<a href={target.externalUrl} target="_blank" rel="noreferrer" />
							}
							nativeButton={false}
						>
							<ExternalLink /> Ver na rede
						</Button>
					)}
					{(target.status === "failed" || target.status === "canceled") && (
						<Button size="sm" onClick={onRetry}>
							<RotateCcw /> Tentar de novo
						</Button>
					)}
					{target.errorInfo?.action === "reconnect" && (
						<Button
							size="sm"
							variant="outline"
							render={<Link href="/contas" />}
							nativeButton={false}
						>
							<Link2 /> Reconectar
						</Button>
					)}
					{target.status === "pending" &&
						post.status === "scheduled" &&
						post.targets.length > 1 && (
							<Button size="sm" variant="ghost" onClick={onCancel}>
								<Ban /> Não publicar aqui
							</Button>
						)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

/** Linha compacta para o Painel: leva para o post em Publicações. */
export function PostRow({ post }: { post: PostItem }) {
	const shown = displayStatus(post.status, post.scheduledAt);
	const platforms = [...new Set(post.targets.map((t) => t.platform))];
	return (
		<Link
			href={`/posts?destaque=${post.id}` as Route}
			className="bg-card hover:border-gold/50 flex min-h-16 items-center gap-3 rounded-2xl border p-2.5 transition-colors"
			data-testid={`post-row-${post.id}`}
		>
			<div className="size-11 shrink-0 overflow-hidden rounded-lg bg-black">
				{post.media && (
					<video
						src={`${post.media.url}#t=0.5`}
						preload="metadata"
						muted
						playsInline
						className="size-full object-cover"
					/>
				)}
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm">{post.caption || "Sem legenda"}</p>
				<p className="text-muted-foreground flex items-center gap-1.5 text-xs">
					{formatWhen(post.scheduledAt)}
					<span className="flex gap-1">
						{platforms.slice(0, 4).map((p) => (
							<PlatformIcon key={p} platform={p} className="size-3" />
						))}
					</span>
				</p>
			</div>
			<StatusBadge status={shown} className="shrink-0" />
		</Link>
	);
}
