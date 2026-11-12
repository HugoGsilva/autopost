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
import { Badge } from "@autopost/ui/components/badge";
import { Button } from "@autopost/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@autopost/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@autopost/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@autopost/ui/components/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@autopost/ui/components/field";
import { Input } from "@autopost/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@autopost/ui/components/select";
import { Skeleton } from "@autopost/ui/components/skeleton";
import { Spinner } from "@autopost/ui/components/spinner";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@autopost/ui/components/tabs";
import { cn } from "@autopost/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2,
	ChevronDown,
	Copy,
	ExternalLink,
	Globe,
	KeyRound,
	Trash2,
	UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { QueryError } from "@/components/page";
import { PlatformBadge } from "@/components/platform-icon";
import { errorMessage } from "@/lib/format";
import type { PlatformItem } from "@/lib/types";
import { orpc } from "@/utils/orpc";

export function SettingsView({ currentUserId }: { currentUserId: string }) {
	return (
		<Tabs defaultValue="platforms">
			<TabsList className="mb-4">
				<TabsTrigger value="platforms">Redes sociais</TabsTrigger>
				<TabsTrigger value="team">Usuários</TabsTrigger>
			</TabsList>
			<TabsContent value="platforms">
				<PlatformsSettings />
			</TabsContent>
			<TabsContent value="team">
				<TeamSettings currentUserId={currentUserId} />
			</TabsContent>
		</Tabs>
	);
}

function PlatformsSettings() {
	const platforms = useQuery(orpc.platforms.list.queryOptions());
	const [open, setOpen] = useState<string | null>(null);

	useEffect(() => {
		const hash = window.location.hash.slice(1);
		if (hash) setOpen(hash);
	}, []);

	if (platforms.isError)
		return (
			<QueryError error={platforms.error} onRetry={() => platforms.refetch()} />
		);
	if (platforms.isPending)
		return (
			<div className="space-y-3">
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={i} className="h-20 rounded-2xl" />
				))}
			</div>
		);

	const oauth = platforms.data.platforms.filter((p) => p.auth === "oauth");
	const manual = platforms.data.platforms.filter((p) => p.auth === "manual");

	return (
		<div className="space-y-6">
			{!platforms.data.appUrlIsPublic && (
				<Alert>
					<Globe />
					<AlertTitle>O login das redes ainda não vai funcionar</AlertTitle>
					<AlertDescription>
						O Cast está rodando num endereço local. As redes só aceitam conexões
						de um endereço público com https (ex.: cast.ia2s.com.br). Peça ao
						responsável técnico para publicar o sistema e definir a variável
						APP_URL; depois as URLs de retorno abaixo passam a mostrar o
						endereço certo.
					</AlertDescription>
				</Alert>
			)}
			<div className="space-y-3">
				{oauth.map((p) => (
					<PlatformConfigCard
						key={p.id}
						platform={p}
						open={open === p.id}
						onToggle={() => setOpen(open === p.id ? null : p.id)}
					/>
				))}
			</div>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Sem configuração necessária
					</CardTitle>
					<CardDescription>
						Estas conectam direto pela tela de Contas, com as credenciais da
						própria conta.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-3">
					{manual.map((p) => (
						<span
							key={p.id}
							className="flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm"
						>
							<PlatformBadge platform={p.id} color={p.brandColor} size="sm" />
							{p.name}
						</span>
					))}
				</CardContent>
			</Card>
		</div>
	);
}

function PlatformConfigCard({
	platform,
	open,
	onToggle,
}: {
	platform: PlatformItem;
	open: boolean;
	onToggle: () => void;
}) {
	const qc = useQueryClient();
	const [clientId, setClientId] = useState(platform.clientId ?? "");
	const [secret, setSecret] = useState("");
	const [confirmRemove, setConfirmRemove] = useState(false);
	const invalidate = () =>
		qc.invalidateQueries({ queryKey: orpc.platforms.list.key() });
	const save = useMutation(
		orpc.platforms.saveConfig.mutationOptions({
			onSuccess: () => {
				toast.success(
					`${platform.name} configurado! Agora é só conectar as contas.`,
				);
				setSecret("");
				invalidate();
			},
			onError: (e) => toast.error(errorMessage(e)),
		}),
	);
	const remove = useMutation(
		orpc.platforms.removeConfig.mutationOptions({
			onSuccess: () => {
				toast.success("Configuração removida");
				setClientId("");
				invalidate();
			},
		}),
	);
	const setup = platform.setup;

	return (
		<Card
			id={platform.id}
			className={cn("scroll-mt-24 gap-0 py-0", open && "border-gold/50")}
			data-testid={`config-${platform.id}`}
		>
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full items-center gap-3 p-4 text-left"
			>
				<PlatformBadge platform={platform.id} color={platform.brandColor} />
				<div className="min-w-0 flex-1">
					<p className="font-semibold">{platform.name}</p>
					<p className="text-muted-foreground truncate text-xs">
						{platform.tagline}
					</p>
				</div>
				{platform.configured ? (
					<Badge className="bg-success/15 text-success gap-1">
						<CheckCircle2 className="size-3" /> Configurado
					</Badge>
				) : (
					<Badge variant="outline" className="text-muted-foreground">
						Não configurado
					</Badge>
				)}
				<ChevronDown
					className={cn(
						"text-muted-foreground size-4 transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>
			{open && setup && (
				<div className="grid gap-6 border-t p-4 md:grid-cols-2 md:p-6">
					<div className="space-y-4">
						<p className="text-sm font-semibold">Passo a passo</p>
						<ol className="space-y-3">
							{setup.steps.map((s, i) => (
								<li
									key={s}
									className="text-muted-foreground flex gap-3 text-sm"
								>
									<span className="border-gold/50 text-gold-ink flex size-5 shrink-0 items-center justify-center rounded-full border text-xs">
										{i + 1}
									</span>
									<span>{s}</span>
								</li>
							))}
						</ol>
						<Button
							variant="link"
							className="px-0"
							render={
								<a href={setup.consoleUrl} target="_blank" rel="noreferrer" />
							}
							nativeButton={false}
						>
							Abrir painel de desenvolvedor <ExternalLink />
						</Button>
						<p className="text-muted-foreground text-xs">
							Permissões usadas:{" "}
							<span className="font-mono">{setup.scopes.join(", ")}</span>
						</p>
					</div>
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							save.mutate({
								platform: platform.id,
								clientId,
								clientSecret: secret || undefined,
							});
						}}
					>
						<Field>
							<FieldLabel>
								URL de retorno (copie e cole no painel da rede)
							</FieldLabel>
							<div className="flex gap-2">
								<Input
									readOnly
									value={platform.redirectUri}
									className="font-mono text-xs"
									onFocus={(e) => e.target.select()}
								/>
								<Button
									type="button"
									variant="outline"
									size="icon"
									aria-label="Copiar URL"
									onClick={() => {
										navigator.clipboard.writeText(platform.redirectUri);
										toast.success("URL copiada");
									}}
								>
									<Copy />
								</Button>
							</div>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${platform.id}-id`}>
								{setup.clientIdLabel ?? "Client ID"}
							</FieldLabel>
							<Input
								id={`${platform.id}-id`}
								value={clientId}
								onChange={(e) => setClientId(e.target.value)}
								required
								autoComplete="off"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${platform.id}-secret`}>
								{setup.clientSecretLabel ?? "Client Secret"}
							</FieldLabel>
							<Input
								id={`${platform.id}-secret`}
								type="password"
								value={secret}
								onChange={(e) => setSecret(e.target.value)}
								placeholder={
									platform.configured
										? "•••••••• (salvo — preencha só para trocar)"
										: ""
								}
								required={!platform.configured}
								autoComplete="new-password"
							/>
						</Field>
						<div className="flex flex-wrap gap-2">
							<Button type="submit" disabled={save.isPending}>
								{save.isPending && <Spinner />} Salvar
							</Button>
							{platform.configured && (
								<Button
									type="button"
									variant={confirmRemove ? "destructive" : "ghost"}
									onClick={() => {
										if (!confirmRemove) {
											setConfirmRemove(true);
											setTimeout(() => setConfirmRemove(false), 5000);
										} else remove.mutate({ platform: platform.id });
									}}
								>
									<Trash2 />{" "}
									{confirmRemove
										? "Confirmar: desliga as contas desta rede"
										: "Remover"}
								</Button>
							)}
						</div>
						<p className="text-muted-foreground text-xs">
							O segredo é guardado criptografado e nunca é exibido de novo.
						</p>
					</form>
				</div>
			)}
		</Card>
	);
}

const roleItems = [
	{ value: "member", label: "Membro" },
	{ value: "admin", label: "Administrador" },
];

const DAY = 86_400_000;

function accessLabel(until: Date | string | null) {
	if (!until) return { text: "Sem prazo", expired: false };
	const d = new Date(until);
	const date = d.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
	});
	return d.getTime() < Date.now()
		? { text: `Encerrado em ${date}`, expired: true }
		: { text: `Acesso até ${date}`, expired: false };
}

function TeamSettings({ currentUserId }: { currentUserId: string }) {
	const qc = useQueryClient();
	const team = useQuery(orpc.team.list.queryOptions());
	const [adding, setAdding] = useState(false);
	const [removingUser, setRemovingUser] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [resetting, setResetting] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const resetPassword = useMutation(
		orpc.team.resetPassword.mutationOptions({
			onSuccess: () => {
				toast.success("Senha redefinida. Envie a nova senha para a pessoa.");
				setResetting(null);
			},
			onError: (e) => toast.error(errorMessage(e)),
		}),
	);
	const [role, setRole] = useState("member");
	const invalidate = () =>
		qc.invalidateQueries({ queryKey: orpc.team.list.key() });
	const create = useMutation(
		orpc.team.create.mutationOptions({
			onSuccess: () => {
				toast.success("Acesso criado. Envie o e-mail e a senha para a pessoa.");
				setAdding(false);
				invalidate();
			},
		}),
	);
	const remove = useMutation(
		orpc.team.remove.mutationOptions({
			onSuccess: invalidate,
			onError: (e) => toast.error(errorMessage(e)),
		}),
	);
	const setAccess = useMutation(
		orpc.team.setAccess.mutationOptions({
			onSuccess: () => {
				toast.success("Acesso atualizado");
				invalidate();
			},
			onError: (e) => toast.error(errorMessage(e)),
		}),
	);
	const setUserRole = useMutation(
		orpc.team.setRole.mutationOptions({
			onSuccess: invalidate,
			onError: (e) => toast.error(errorMessage(e)),
		}),
	);

	if (team.isError)
		return <QueryError error={team.error} onRetry={() => team.refetch()} />;

	return (
		<Card>
			<CardHeader className="flex flex-row items-start justify-between gap-4">
				<div className="space-y-1">
					<CardTitle className="text-base">Usuários</CardTitle>
					<CardDescription>
						Todos os cadastros do Cast. Quem se cadastra sozinho entra no teste
						grátis; aqui você estende ou libera o acesso de quem fechou com a
						IA2S. Administradores também configuram as redes.
					</CardDescription>
				</div>
				<Button onClick={() => setAdding(true)}>
					<UserPlus /> Adicionar
				</Button>
			</CardHeader>
			<CardContent className="space-y-2">
				{team.isPending && <Skeleton className="h-14 rounded-xl" />}
				{team.data?.map((u) => (
					<div
						key={u.id}
						className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2"
					>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium">
								{u.name}{" "}
								{u.id === currentUserId && (
									<span className="text-muted-foreground">(você)</span>
								)}
							</p>
							<p className="text-muted-foreground truncate text-xs">
								{u.email}
							</p>
						</div>
						{u.id !== currentUserId && (
							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<Button
											variant="outline"
											size="sm"
											aria-label={`Acesso de ${u.name}`}
										/>
									}
								>
									<Badge
										variant={
											accessLabel(u.accessUntil).expired
												? "destructive"
												: "secondary"
										}
									>
										{accessLabel(u.accessUntil).text}
									</Badge>
									<ChevronDown />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onClick={() =>
											setAccess.mutate({
												id: u.id,
												until: new Date(Date.now() + 7 * DAY),
											})
										}
									>
										Liberar por 7 dias
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() =>
											setAccess.mutate({
												id: u.id,
												until: new Date(Date.now() + 30 * DAY),
											})
										}
									>
										Liberar por 30 dias
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => setAccess.mutate({ id: u.id, until: null })}
									>
										Liberar sem prazo
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										variant="destructive"
										onClick={() =>
											setAccess.mutate({ id: u.id, until: new Date() })
										}
									>
										Encerrar acesso agora
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
						<Select
							items={roleItems}
							value={u.role}
							disabled={u.id === currentUserId}
							onValueChange={(v) =>
								setUserRole.mutate({ id: u.id, role: v as "admin" | "member" })
							}
						>
							<SelectTrigger className="w-40">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{roleItems.map((r) => (
									<SelectItem key={r.value} value={r.value}>
										{r.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							variant="ghost"
							size="icon"
							aria-label={`Redefinir senha de ${u.name}`}
							disabled={u.id === currentUserId}
							onClick={() => setResetting(u)}
						>
							<KeyRound />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							aria-label={`Remover ${u.name}`}
							disabled={u.id === currentUserId}
							onClick={() => setRemovingUser(u)}
						>
							<Trash2 />
						</Button>
					</div>
				))}
			</CardContent>

			<Dialog open={adding} onOpenChange={setAdding}>
				<DialogContent className="sm:max-w-md">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							const d = new FormData(e.currentTarget);
							create.mutate({
								name: String(d.get("name")),
								email: String(d.get("email")),
								password: String(d.get("password")),
								role: role as "admin" | "member",
							});
						}}
					>
						<DialogHeader className="mb-4">
							<DialogTitle>Novo acesso</DialogTitle>
							<DialogDescription>
								Defina uma senha inicial e envie para a pessoa.
							</DialogDescription>
						</DialogHeader>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="t-name">Nome</FieldLabel>
								<Input id="t-name" name="name" required />
							</Field>
							<Field>
								<FieldLabel htmlFor="t-email">E-mail</FieldLabel>
								<Input id="t-email" name="email" type="email" required />
							</Field>
							<Field>
								<FieldLabel htmlFor="t-pass">Senha inicial</FieldLabel>
								<Input
									id="t-pass"
									name="password"
									type="text"
									minLength={8}
									required
									autoComplete="off"
								/>
							</Field>
							<Field>
								<FieldLabel>Papel</FieldLabel>
								<Select
									items={roleItems}
									value={role}
									onValueChange={(v) => setRole(String(v))}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{roleItems.map((r) => (
											<SelectItem key={r.value} value={r.value}>
												{r.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						</FieldGroup>
						{create.error && (
							<p className="text-destructive mt-4 text-sm">
								{errorMessage(create.error)}
							</p>
						)}
						<DialogFooter className="mt-6">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setAdding(false)}
							>
								Cancelar
							</Button>
							<Button type="submit" disabled={create.isPending}>
								{create.isPending && <Spinner />} Criar acesso
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			<AlertDialog
				open={Boolean(removingUser)}
				onOpenChange={(o) => !o && setRemovingUser(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Remover o acesso de {removingUser?.name}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Apaga o cadastro, as publicações, os vídeos e as contas de redes
							que a pessoa conectou. Não dá para desfazer.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								if (removingUser) remove.mutate({ id: removingUser.id });
								setRemovingUser(null);
							}}
						>
							Remover usuário
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog
				open={Boolean(resetting)}
				onOpenChange={(o) => !o && setResetting(null)}
			>
				<DialogContent className="sm:max-w-md">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							const d = new FormData(e.currentTarget);
							if (resetting)
								resetPassword.mutate({
									id: resetting.id,
									password: String(d.get("password")),
								});
						}}
					>
						<DialogHeader className="mb-4">
							<DialogTitle>Nova senha para {resetting?.name}</DialogTitle>
							<DialogDescription>
								Use quando alguém esquecer a senha. A pessoa pode trocá-la
								depois no menu do perfil.
							</DialogDescription>
						</DialogHeader>
						<Field>
							<FieldLabel htmlFor="reset-pass">Nova senha</FieldLabel>
							<Input
								id="reset-pass"
								name="password"
								type="text"
								minLength={8}
								required
								autoComplete="off"
								className="h-11"
							/>
						</Field>
						<DialogFooter className="mt-6">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setResetting(null)}
							>
								Cancelar
							</Button>
							<Button type="submit" disabled={resetPassword.isPending}>
								{resetPassword.isPending && <Spinner />} Salvar senha
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
