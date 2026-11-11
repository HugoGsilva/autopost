"use client";

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@autopost/ui/components/alert";
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
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@autopost/ui/components/avatar";
import { Button } from "@autopost/ui/components/button";
import { Card } from "@autopost/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@autopost/ui/components/dialog";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@autopost/ui/components/empty";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@autopost/ui/components/field";
import { Input } from "@autopost/ui/components/input";
import { Skeleton } from "@autopost/ui/components/skeleton";
import { Spinner } from "@autopost/ui/components/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Globe,
	Info,
	Link2,
	Plus,
	RefreshCw,
	Settings2,
	Trash2,
	UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { QueryError } from "@/components/page";
import { PlatformBadge } from "@/components/platform-icon";
import { errorMessage } from "@/lib/format";
import type { AccountItem, PlatformItem } from "@/lib/types";
import { orpc } from "@/utils/orpc";

export function AccountsView({
	isAdmin,
	userId,
}: {
	isAdmin: boolean;
	userId: string;
}) {
	const qc = useQueryClient();
	const router = useRouter();
	const params = useSearchParams();
	const platforms = useQuery(orpc.platforms.list.queryOptions());
	const accounts = useQuery(orpc.accounts.list.queryOptions());
	const [manual, setManual] = useState<PlatformItem | null>(null);
	const [removing, setRemoving] = useState<AccountItem | null>(null);

	useEffect(() => {
		const ok = params.get("conectado");
		const err = params.get("erro");
		if (!ok && !err) return;
		if (ok) {
			const n = Number(params.get("n") ?? 1);
			toast.success(
				n > 1 ? `${n} contas do ${ok} conectadas!` : `${ok} conectado!`,
			);
			qc.invalidateQueries({ queryKey: orpc.accounts.list.key() });
		}
		if (err) toast.error(err, { duration: 12_000 });
		router.replace("/contas");
	}, [params, router, qc]);

	const remove = useMutation(
		orpc.accounts.remove.mutationOptions({
			onSuccess: () => {
				toast.success("Conta desconectada");
				qc.invalidateQueries({ queryKey: orpc.accounts.list.key() });
				setRemoving(null);
			},
			onError: (e) => toast.error(errorMessage(e)),
		}),
	);

	if (platforms.isError || accounts.isError)
		return (
			<QueryError
				error={platforms.error ?? accounts.error}
				onRetry={() => {
					platforms.refetch();
					accounts.refetch();
				}}
			/>
		);

	if (platforms.isPending || accounts.isPending)
		return (
			<div className="space-y-4">
				<Skeleton className="h-24 rounded-2xl" />
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-36 rounded-2xl" />
					))}
				</div>
			</div>
		);

	const list = platforms.data.platforms;
	const platformOf = (id: string) => list.find((p) => p.id === id);
	const mine = accounts.data.filter((a) => platformOf(a.platform));
	const ready = list.filter((p) => p.configured);
	const pending = list.filter((p) => !p.configured);
	// As mais usadas primeiro. O resto (Bluesky, Discord, Demo…) fica depois.
	const popularFirst = [
		"instagram",
		"telegram",
		"facebook",
		"youtube",
		"tiktok",
		"linkedin",
		"x",
	];
	const byUse = (a: PlatformItem, b: PlatformItem) => {
		const rank = (id: string) => {
			const i = popularFirst.indexOf(id);
			return i === -1 ? popularFirst.length : i;
		};
		return rank(a.id) - rank(b.id);
	};
	const connectable = (isAdmin ? list : ready).slice().sort(byUse);

	return (
		<div className="space-y-10">
			<section className="space-y-3" data-testid="my-accounts">
				<h2 className="font-display text-2xl">Suas contas</h2>
				{mine.length === 0 ? (
					<Empty className="border">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<UsersRound />
							</EmptyMedia>
							<EmptyTitle>Nenhuma conta conectada ainda</EmptyTitle>
							<EmptyDescription>
								Escolha uma rede abaixo e conecte. Leva menos de um minuto.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
						{mine.map((a) => (
							<AccountRow
								key={a.id}
								account={a}
								platform={platformOf(a.platform)}
								canManage={isAdmin || a.connectedBy === userId}
								onRemove={() => setRemoving(a)}
							/>
						))}
					</div>
				)}
			</section>

			<section className="space-y-3">
				<div>
					<h2 className="font-display text-2xl">Conectar nova conta</h2>
					<p className="text-muted-foreground text-sm">
						Você entra na rede, autoriza, e volta para cá já conectado.
					</p>
				</div>
				{isAdmin &&
					!platforms.data.appUrlIsPublic &&
					pending.some((p) => p.auth !== "manual") && (
						<Alert>
							<Globe />
							<AlertTitle>Sistema em endereço local</AlertTitle>
							<AlertDescription>
								As redes só aceitam o login quando o Cast está publicado no
								domínio da empresa (https). Peça ao responsável técnico para
								publicar e definir a variável APP_URL.
							</AlertDescription>
						</Alert>
					)}
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{connectable.map((p) => (
						<Card
							key={p.id}
							className="gap-3 p-4"
							data-testid={`platform-${p.id}`}
						>
							<div className="flex items-start gap-3">
								<PlatformBadge platform={p.id} color={p.brandColor} size="lg" />
								<div className="min-w-0 space-y-0.5">
									<p className="font-semibold">{p.name}</p>
									<p className="text-muted-foreground text-xs leading-relaxed">
										{p.tagline}
									</p>
								</div>
							</div>
							{p.requirements && (
								<p className="text-muted-foreground flex gap-1.5 text-xs leading-relaxed">
									<Info className="text-gold-ink mt-0.5 size-3.5 shrink-0" />
									{p.requirements}
								</p>
							)}
							{p.configured ? (
								<ConnectButton
									platform={p}
									hasAccounts={mine.some((a) => a.platform === p.id)}
									onManual={() => setManual(p)}
								/>
							) : (
								<Button
									variant="outline"
									className="h-11 w-full"
									render={<Link href={`/configuracoes#${p.id}`} />}
									nativeButton={false}
								>
									<Settings2 /> Configurar
								</Button>
							)}
						</Card>
					))}
				</div>
			</section>

			{!isAdmin && pending.length > 0 && (
				<p className="text-muted-foreground text-sm">
					Outras redes ({pending.map((p) => p.name).join(", ")}) podem ser
					liberadas pelo administrador.
				</p>
			)}

			<ManualConnectDialog platform={manual} onClose={() => setManual(null)} />

			<AlertDialog
				open={Boolean(removing)}
				onOpenChange={(o) => !o && setRemoving(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Desconectar {removing?.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							Os posts agendados para esta conta deixam de ser publicados nela.
							Você pode reconectar quando quiser.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={remove.isPending}
							onClick={() => removing && remove.mutate({ id: removing.id })}
						>
							Desconectar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function AccountRow({
	account,
	platform,
	canManage,
	onRemove,
}: {
	account: AccountItem;
	platform?: PlatformItem;
	canManage: boolean;
	onRemove: () => void;
}) {
	const problem = account.status !== "active";
	return (
		<div
			className="bg-card flex items-center gap-3 rounded-2xl border px-3 py-2.5"
			data-testid={`my-account-${account.id}`}
		>
			<span className="relative shrink-0">
				<Avatar className="size-10">
					{account.avatarUrl && <AvatarImage src={account.avatarUrl} alt="" />}
					<AvatarFallback className="text-xs">
						{account.name.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<PlatformBadge
					platform={account.platform}
					color={platform?.brandColor ?? "#888888"}
					size="sm"
					className="ring-card absolute -right-1 -bottom-1 size-5 rounded-full ring-2 [&_svg]:size-3"
				/>
			</span>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{account.name}</p>
				<p className="text-muted-foreground truncate text-xs">
					{platform?.name}
					{account.username ? ` · @${account.username.replace(/^@/, "")}` : ""}
				</p>
				{problem && (
					<p className="text-destructive text-xs">
						{account.status === "expired"
							? "Conexão expirada — reconecte"
							: "Com erro — reconecte"}
					</p>
				)}
			</div>
			{problem && platform?.auth === "oauth" && (
				<Button
					size="sm"
					render={<a href={`/api/connect/${account.platform}`} />}
					nativeButton={false}
				>
					<RefreshCw /> Reconectar
				</Button>
			)}
			{canManage && (
				<Button
					variant="ghost"
					size="icon"
					aria-label={`Desconectar ${account.name}`}
					onClick={onRemove}
				>
					<Trash2 />
				</Button>
			)}
		</div>
	);
}

function ConnectButton({
	platform,
	hasAccounts,
	onManual,
}: {
	platform: PlatformItem;
	hasAccounts: boolean;
	onManual: () => void;
}) {
	const variant = hasAccounts ? "outline" : "default";
	if (platform.auth === "manual")
		return (
			<Button variant={variant} className="h-11 w-full" onClick={onManual}>
				<Plus /> {hasAccounts ? "Conectar outra" : "Conectar"}
			</Button>
		);
	return (
		<Button
			variant={variant}
			className="h-11 w-full"
			render={<a href={`/api/connect/${platform.id}`} />}
			nativeButton={false}
		>
			<Link2 />{" "}
			{hasAccounts ? "Conectar outra conta" : `Entrar com ${platform.name}`}
		</Button>
	);
}

function ManualConnectDialog({
	platform,
	onClose,
}: {
	platform: PlatformItem | null;
	onClose: () => void;
}) {
	const qc = useQueryClient();
	const connect = useMutation(
		orpc.accounts.connectManual.mutationOptions({
			onSuccess: (res) => {
				toast.success(`${res.name} conectado!`);
				qc.invalidateQueries({ queryKey: orpc.accounts.list.key() });
				onClose();
			},
		}),
	);

	return (
		<Dialog
			open={Boolean(platform)}
			onOpenChange={(o) => {
				if (!o) {
					connect.reset();
					onClose();
				}
			}}
		>
			<DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
				{platform && (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							const data = new FormData(e.currentTarget);
							const fields = Object.fromEntries(
								(platform.manualFields ?? []).map((f) => [
									f.key,
									String(data.get(f.key) ?? "").trim(),
								]),
							);
							connect.mutate({ platform: platform.id, fields });
						}}
					>
						<DialogHeader className="mb-4">
							<div className="mb-2">
								<PlatformBadge
									platform={platform.id}
									color={platform.brandColor}
								/>
							</div>
							<DialogTitle>Conectar {platform.name}</DialogTitle>
							<DialogDescription>
								{platform.requirements ?? platform.tagline}
							</DialogDescription>
						</DialogHeader>
						<FieldGroup>
							{platform.manualFields?.map((f) => (
								<Field key={f.key}>
									<FieldLabel htmlFor={`f-${f.key}`}>
										{f.label}
										{f.optional && !f.label.includes("(") && (
											<span className="text-muted-foreground font-normal">
												(opcional)
											</span>
										)}
									</FieldLabel>
									<Input
										id={`f-${f.key}`}
										name={f.key}
										type={
											f.type === "password"
												? "password"
												: f.type === "url"
													? "url"
													: "text"
										}
										placeholder={f.placeholder}
										required={!f.optional}
										autoComplete="off"
										className="h-11"
									/>
									{f.help && <FieldDescription>{f.help}</FieldDescription>}
								</Field>
							))}
						</FieldGroup>
						{connect.error && (
							<p className="text-destructive mt-4 text-sm">
								{errorMessage(connect.error)}
							</p>
						)}
						<DialogFooter className="mt-6">
							<Button type="button" variant="ghost" onClick={onClose}>
								Cancelar
							</Button>
							<Button type="submit" disabled={connect.isPending}>
								{connect.isPending && <Spinner />} Conectar
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
