"use client";

import { Badge } from "@autopost/ui/components/badge";
import { Button } from "@autopost/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@autopost/ui/components/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@autopost/ui/components/empty";
import { Field, FieldLabel } from "@autopost/ui/components/field";
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
import { Switch } from "@autopost/ui/components/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@autopost/ui/components/tabs";
import { Textarea } from "@autopost/ui/components/textarea";
import { cn } from "@autopost/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Circle, Link2, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { QueryError } from "@/components/page";
import { PlatformBadge, PlatformIcon } from "@/components/platform-icon";
import { errorMessage, formatWhen, plural } from "@/lib/format";
import type { AccountItem, PlatformItem } from "@/lib/types";
import { client, orpc } from "@/utils/orpc";

import { Destinations } from "./destinations";
import {
	defaultSchedule,
	type Schedule,
	SchedulePicker,
	scheduleToDate,
} from "./schedule-picker";
import { type UploadedMedia, useVideoUpload } from "./use-upload";
import { VideoDrop } from "./video-drop";

type Override = {
	custom: boolean;
	caption: string;
	options: Record<string, string>;
};

const len = (s: string) => Array.from(s).length;

const FORMAT_LABELS: Record<string, string> = {
	"video/mp4": "MP4",
	"video/quicktime": "MOV",
	"video/webm": "WebM",
};
const formatLabel = (mime: string) => FORMAT_LABELS[mime] ?? mime;

/** Problemas que impedem publicar numa rede. */
function problemsFor(
	account: AccountItem,
	platform: PlatformItem | undefined,
	caption: string,
	media: UploadedMedia | null,
	appUrlIsPublic: boolean,
): string[] {
	if (!platform) return [];
	const out: string[] = [];
	if (media && !platform.acceptedTypes.includes(media.mimeType))
		out.push(
			`Não aceita ${formatLabel(media.mimeType)} — envie em ${platform.acceptedTypes.map(formatLabel).join(" ou ")}`,
		);
	if (len(caption) > platform.captionLimit)
		out.push(`Legenda acima de ${platform.captionLimit} caracteres`);
	if (
		media &&
		platform.maxSizeMB &&
		media.size > platform.maxSizeMB * 1024 * 1024
	)
		out.push(`Vídeo acima de ${platform.maxSizeMB} MB`);
	if (
		media?.durationSec &&
		platform.maxDurationSec &&
		media.durationSec > platform.maxDurationSec
	)
		out.push(`Vídeo acima de ${Math.round(platform.maxDurationSec / 60)} min`);
	if (platform.requiresPublicUrl && !appUrlIsPublic)
		out.push("Só funciona com o sistema publicado no domínio da empresa");
	if (account.status === "expired")
		out.push("Conexão expirada — reconecte em Contas");
	return out;
}

/** Avisos que não bloqueiam (ex.: vídeo horizontal no Reels/TikTok). */
function hintsFor(
	platform: PlatformItem | undefined,
	media: UploadedMedia | null,
): string[] {
	if (!platform?.preferredAspect || !media?.width || !media.height) return [];
	if (platform.preferredAspect === "vertical" && media.height <= media.width)
		return [
			"Vídeo horizontal: vai aparecer com faixas. O ideal aqui é vertical (9:16).",
		];
	return [];
}

export function Composer() {
	const router = useRouter();
	const qc = useQueryClient();
	const params = useSearchParams();
	const platforms = useQuery(orpc.platforms.list.queryOptions());
	const accounts = useQuery(orpc.accounts.list.queryOptions());
	const upload = useVideoUpload();
	const [selected, setSelected] = useState<string[]>([]);
	const [caption, setCaption] = useState("");
	const [overrides, setOverrides] = useState<Record<string, Override>>({});
	const [schedule, setSchedule] = useState<Schedule>(defaultSchedule);
	const submitted = useRef(false);

	// "Usar de novo": /novo?video=<id>&legenda=...
	const reuseId = params.get("video");
	useEffect(() => {
		if (!reuseId) return;
		const text = params.get("legenda");
		if (text) setCaption(text);
		client.posts
			.media({ id: reuseId })
			.then((m) => upload.adoptExisting(m))
			.catch((e) => toast.error(errorMessage(e)));
	}, [reuseId, params, upload.adoptExisting]);

	// Atalho da agenda: /novo?data=2026-11-05 já abre agendado para esse dia
	const presetDay = params.get("data");
	useEffect(() => {
		if (!presetDay || !/^\d{4}-\d{2}-\d{2}$/.test(presetDay)) return;
		const [y, m, d] = presetDay.split("-").map(Number);
		setSchedule({
			mode: "later",
			date: new Date(y!, m! - 1, d!),
			time: "09:00",
		});
	}, [presetDay]);

	// Avisa antes de sair no meio do envio ou com o post montado e não publicado.
	const dirty =
		upload.uploading ||
		(Boolean(upload.media) && !reuseId) ||
		caption.length > 0;
	useEffect(() => {
		if (!dirty) return;
		const warn = (e: BeforeUnloadEvent) => {
			if (!submitted.current) e.preventDefault();
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);

	const create = useMutation(
		orpc.posts.create.mutationOptions({
			onSuccess: (res) => {
				submitted.current = true;
				toast.success(
					res.immediate
						? "Enviando para as redes! Acompanhe o status."
						: `Agendado para ${formatWhen(res.scheduledAt)}`,
				);
				qc.invalidateQueries({ queryKey: orpc.posts.key() });
				router.push(`/posts?destaque=${res.id}`);
			},
			onError: (e) => toast.error(errorMessage(e), { duration: 10_000 }),
		}),
	);

	const platformOf = (id: string) =>
		platforms.data?.platforms.find((p) => p.id === id);
	const usable = useMemo(
		() =>
			(accounts.data ?? []).filter((a) =>
				platforms.data?.platforms.some((p) => p.id === a.platform),
			),
		[accounts.data, platforms.data],
	);
	const chosen = useMemo(
		() =>
			selected
				.map((id) => usable.find((a) => a.id === id))
				.filter((a): a is AccountItem => Boolean(a)),
		[selected, usable],
	);
	const override = (id: string): Override =>
		overrides[id] ?? { custom: false, caption: "", options: {} };
	const setOverride = (id: string, patch: Partial<Override>) =>
		setOverrides((o) => ({ ...o, [id]: { ...override(id), ...patch } }));
	const captionFor = (id: string) =>
		override(id).custom ? override(id).caption : caption;

	const appUrlIsPublic = platforms.data?.appUrlIsPublic ?? false;
	const issues = chosen.map((a) => ({
		account: a,
		problems: problemsFor(
			a,
			platformOf(a.platform),
			captionFor(a.id),
			upload.media,
			appUrlIsPublic,
		),
		hints: hintsFor(platformOf(a.platform), upload.media),
	}));
	const when = scheduleToDate(schedule);
	const checklist = [
		{
			ok: Boolean(upload.media),
			label: upload.media
				? "Vídeo enviado"
				: upload.uploading
					? `Enviando vídeo (${upload.progress ?? 0}%)`
					: "Envie um vídeo",
		},
		{
			ok: chosen.length > 0,
			label: chosen.length
				? plural(chosen.length, "destino", "destinos")
				: "Escolha pelo menos um destino",
		},
		{
			ok: !issues.some((i) => i.problems.length),
			label: issues.some((i) => i.problems.length)
				? "Corrija os avisos em vermelho"
				: "Tudo certo com as redes",
			hidden: !chosen.length,
		},
		{
			ok: !(when && when.getTime() < Date.now()),
			label: when
				? when.getTime() < Date.now()
					? "Horário já passou"
					: formatWhen(when)
				: "Sai assim que confirmar",
		},
	].filter((c) => !c.hidden);
	const blocker = checklist.find((c) => !c.ok);
	const ready = !blocker;
	const submitLabel = when
		? "Agendar post"
		: chosen.length
			? `Publicar em ${chosen.length} ${chosen.length === 1 ? "rede" : "redes"}`
			: "Publicar";

	const submit = () => {
		if (!upload.media || !ready) return;
		create.mutate({
			mediaId: upload.media.id,
			caption,
			scheduledAt: when,
			targets: chosen.map((a) => {
				const o = override(a.id);
				return {
					accountId: a.id,
					caption: o.custom ? o.caption : null,
					options: o.options,
				};
			}),
		});
	};

	if (platforms.isError || accounts.isError)
		return <QueryError error={platforms.error ?? accounts.error} />;
	if (platforms.isPending || accounts.isPending)
		return (
			<div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
				<Skeleton className="h-[36rem] rounded-2xl" />
				<Skeleton className="hidden h-96 rounded-2xl lg:block" />
			</div>
		);

	const limits = [...new Set(chosen.map((a) => a.platform))]
		.map((id) => platformOf(id))
		.filter((p): p is PlatformItem => Boolean(p))
		.sort((a, b) => a.captionLimit - b.captionLimit);
	const vertical = (upload.media?.height ?? 1) > (upload.media?.width ?? 0);

	const submitButton = (
		<Button
			size="lg"
			className="glow-gold disabled:bg-muted disabled:text-muted-foreground h-12 w-full text-base font-semibold disabled:opacity-100 disabled:shadow-none"
			disabled={!ready || create.isPending}
			onClick={submit}
			data-testid="submit-post"
		>
			{create.isPending ? <Spinner /> : <Send />}
			{submitLabel}
		</Button>
	);

	return (
		<div className="grid min-w-0 items-start gap-6 pb-32 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-0">
			<div className="min-w-0 space-y-6">
				<Step n={1} title="Vídeo">
					<VideoDrop upload={upload} />
				</Step>

				<Step n={2} title="Onde publicar">
					{usable.length === 0 ? (
						<Empty className="border">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Link2 />
								</EmptyMedia>
								<EmptyTitle>Nenhuma conta conectada</EmptyTitle>
								<EmptyDescription>
									Conecte Instagram, TikTok, YouTube e outras redes para
									escolher aqui.
								</EmptyDescription>
							</EmptyHeader>
							<EmptyContent>
								<Button render={<Link href="/contas" />} nativeButton={false}>
									Conectar contas
								</Button>
							</EmptyContent>
						</Empty>
					) : (
						<Destinations
							accounts={usable}
							platforms={platforms.data.platforms}
							selected={selected}
							onChange={setSelected}
						/>
					)}
				</Step>

				<Step n={3} title="Legenda">
					<Textarea
						value={caption}
						onChange={(e) => setCaption(e.target.value)}
						placeholder="Escreva a legenda... #hashtags e links funcionam normalmente"
						className="min-h-36 text-base"
						data-testid="caption"
						aria-label="Legenda"
					/>
					<div className="mt-2 flex flex-wrap gap-2">
						<span className="text-muted-foreground text-xs">
							{len(caption)} caracteres
						</span>
						{limits.map((p) => {
							const over = len(caption) > p.captionLimit;
							return (
								<Badge
									key={p.id}
									variant="outline"
									className={cn(
										"gap-1",
										over
											? "border-destructive/50 text-destructive"
											: "text-muted-foreground",
									)}
								>
									<PlatformIcon platform={p.id} className="size-3" />
									{len(caption)}/{p.captionLimit}
								</Badge>
							);
						})}
					</div>

					{chosen.length > 0 && (
						<div className="mt-6">
							<p className="text-sm font-semibold">
								Ajustes por rede (opcional)
							</p>
							<p className="text-muted-foreground mb-3 text-xs">
								Legenda diferente, título do YouTube, privacidade do TikTok...
							</p>
							<Tabs
								defaultValue={chosen[0]!.id}
								key={chosen.map((a) => a.id).join()}
							>
								<TabsList className="h-auto max-w-full flex-wrap justify-start">
									{chosen.map((a) => (
										<TabsTrigger
											key={a.id}
											value={a.id}
											className="min-h-9 gap-1.5"
										>
											<PlatformIcon
												platform={a.platform}
												className="size-3.5"
											/>
											<span className="max-w-28 truncate">{a.name}</span>
										</TabsTrigger>
									))}
								</TabsList>
								{chosen.map((a) => (
									<TabsContent
										key={a.id}
										value={a.id}
										className="mt-3 space-y-4 rounded-xl border p-4"
									>
										<TargetSettings
											account={a}
											platform={platformOf(a.platform)}
											value={override(a.id)}
											baseCaption={caption}
											onChange={(patch) => setOverride(a.id, patch)}
										/>
									</TabsContent>
								))}
							</Tabs>
						</div>
					)}
				</Step>

				<Step n={4} title="Quando">
					<SchedulePicker value={schedule} onChange={setSchedule} />
				</Step>

				{/* Celular/tablet: avisos por rede aparecem aqui (o Resumo só existe no desktop) */}
				{issues.some((i) => i.problems.length || i.hints.length) && (
					<Card className="lg:hidden">
						<CardContent className="space-y-3">
							<IssuesList issues={issues} platformOf={platformOf} />
						</CardContent>
					</Card>
				)}
			</div>

			<aside className="hidden space-y-4 lg:sticky lg:top-6 lg:block">
				<Card className="overflow-hidden">
					<CardHeader>
						<CardTitle className="font-display text-xl font-normal">
							Resumo
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{upload.previewUrl && (
							<div
								className={cn(
									"border-foreground/10 relative mx-auto overflow-hidden rounded-2xl border-4 bg-black",
									vertical ? "aspect-[9/16] w-40" : "aspect-video w-full",
								)}
							>
								<video
									src={upload.previewUrl}
									className="size-full object-contain"
									muted
									loop
									autoPlay
									playsInline
								/>
							</div>
						)}

						<ul className="space-y-2" aria-label="O que falta">
							{checklist.map((c) => (
								<li key={c.label} className="flex items-center gap-2 text-sm">
									{c.ok ? (
										<CheckCircle2 className="text-success size-4 shrink-0" />
									) : (
										<Circle className="text-muted-foreground size-4 shrink-0" />
									)}
									<span className={cn(!c.ok && "text-muted-foreground")}>
										{c.label}
									</span>
								</li>
							))}
						</ul>

						{issues.length > 0 && (
							<div className="space-y-2 border-t pt-4">
								<IssuesList issues={issues} platformOf={platformOf} />
							</div>
						)}

						{submitButton}
					</CardContent>
				</Card>
			</aside>

			{/* Barra fixa no celular/tablet: o botão sempre à mão, com o motivo se estiver bloqueado */}
			<div className="bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur md:left-[4.75rem] lg:hidden">
				<div className="mx-auto flex max-w-3xl flex-col gap-2">
					<p
						className={cn(
							"text-center text-xs",
							ready ? "text-success" : "text-muted-foreground",
						)}
					>
						{ready
							? when
								? `Agendado para ${formatWhen(when)}`
								: "Pronto para publicar"
							: `Falta: ${checklist
									.filter((x) => !x.ok)
									.map((x) => x.label.toLowerCase())
									.join(" · ")}`}
					</p>
					{submitButton}
				</div>
			</div>
		</div>
	);
}

type Issue = { account: AccountItem; problems: string[]; hints: string[] };

function IssuesList({
	issues,
	platformOf,
}: {
	issues: Issue[];
	platformOf: (id: string) => PlatformItem | undefined;
}) {
	return (
		<>
			{issues.map(({ account, problems, hints }) => (
				<div key={account.id} className="flex items-start gap-2 text-sm">
					<PlatformBadge
						platform={account.platform}
						color={platformOf(account.platform)?.brandColor ?? "#888888"}
						size="sm"
					/>
					<div className="min-w-0 flex-1">
						<p className="truncate font-medium">{account.name}</p>
						{problems.map((p) => (
							<p key={p} className="text-destructive text-xs">
								{p}
							</p>
						))}
						{hints.map((h) => (
							<p key={h} className="text-warning text-xs">
								{h}
							</p>
						))}
					</div>
					{problems.length ? (
						<AlertTriangle className="text-destructive size-4 shrink-0" />
					) : (
						<CheckCircle2 className="text-success size-4 shrink-0" />
					)}
				</div>
			))}
		</>
	);
}

function Step({
	n,
	title,
	children,
}: {
	n: number;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<Card className="min-w-0">
			<CardHeader className="flex flex-row items-center gap-3">
				<span className="nums border-gold/50 text-gold-ink flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">
					{n}
				</span>
				<CardTitle className="text-base">{title}</CardTitle>
			</CardHeader>
			<CardContent className="min-w-0">{children}</CardContent>
		</Card>
	);
}

function TargetSettings({
	account,
	platform,
	value,
	baseCaption,
	onChange,
}: {
	account: AccountItem;
	platform?: PlatformItem;
	value: Override;
	baseCaption: string;
	onChange: (patch: Partial<Override>) => void;
}) {
	if (!platform) return null;
	const setOption = (key: string, v: string) =>
		onChange({ options: { ...value.options, [key]: v } });
	return (
		<>
			<div className="flex items-center justify-between gap-4">
				<div>
					<p className="text-sm font-medium">Legenda diferente</p>
					<p className="text-muted-foreground text-xs">
						Use outro texto só no {platform.name}.
					</p>
				</div>
				<Switch
					checked={value.custom}
					onCheckedChange={(custom) =>
						onChange({ custom, caption: value.caption || baseCaption })
					}
					aria-label={`Legenda diferente no ${platform.name}`}
				/>
			</div>
			{value.custom && (
				<div>
					<Textarea
						value={value.caption}
						onChange={(e) => onChange({ caption: e.target.value })}
						className="min-h-24"
					/>
					<p
						className={cn(
							"mt-1 text-xs",
							len(value.caption) > platform.captionLimit
								? "text-destructive"
								: "text-muted-foreground",
						)}
					>
						{len(value.caption)}/{platform.captionLimit}
					</p>
				</div>
			)}
			{platform.optionFields?.map((f) => {
				if (f.kind === "text")
					return (
						<Field key={f.key}>
							<FieldLabel>{f.label}</FieldLabel>
							<Input
								value={value.options[f.key] ?? ""}
								maxLength={f.maxLength}
								placeholder={f.placeholder}
								onChange={(e) => setOption(f.key, e.target.value)}
							/>
						</Field>
					);
				const choices =
					typeof f.choices === "string"
						? ((account.meta?.[f.choices.slice(5)] as
								| { value: string; label: string }[]
								| undefined) ?? [])
						: f.choices;
				return (
					<Field key={f.key}>
						<FieldLabel>{f.label}</FieldLabel>
						<Select
							items={choices}
							value={value.options[f.key] ?? choices[0]?.value ?? null}
							onValueChange={(v) => setOption(f.key, String(v))}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Escolha..." />
							</SelectTrigger>
							<SelectContent>
								{choices.map((c) => (
									<SelectItem key={c.value} value={c.value}>
										{c.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				);
			})}
			{platform.warning && (
				<p className="text-muted-foreground flex gap-1.5 text-xs">
					<AlertTriangle className="text-warning mt-0.5 size-3 shrink-0" />
					{platform.warning}
				</p>
			)}
		</>
	);
}
