import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@autopost/ui/components/alert";
import { Badge } from "@autopost/ui/components/badge";
import { Button } from "@autopost/ui/components/button";
import { cn } from "@autopost/ui/lib/utils";
import {
	AlertTriangle,
	Ban,
	CheckCircle2,
	CircleDot,
	Clock,
	Loader2,
	XCircle,
} from "lucide-react";

export function PageContainer({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function PageHeader({
	eyebrow,
	title,
	description,
	actions,
}: {
	eyebrow?: string;
	title: string;
	description?: React.ReactNode;
	actions?: React.ReactNode;
}) {
	return (
		<div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
			<div className="space-y-2">
				{eyebrow && <p className="eyebrow">{eyebrow}</p>}
				<h1 className="font-display text-3xl font-normal md:text-4xl">
					{title}
				</h1>
				{description && (
					<p className="text-muted-foreground max-w-2xl">{description}</p>
				)}
			</div>
			{actions && <div className="flex flex-wrap gap-2">{actions}</div>}
		</div>
	);
}

export function QueryError({
	error,
	onRetry,
}: {
	error: unknown;
	onRetry?: () => void;
}) {
	return (
		<Alert variant="destructive">
			<AlertTriangle />
			<AlertTitle>Não foi possível carregar</AlertTitle>
			<AlertDescription className="flex flex-wrap items-center gap-3">
				{error instanceof Error ? error.message : "Erro inesperado"}
				{onRetry && (
					<Button size="sm" variant="outline" onClick={onRetry}>
						Tentar de novo
					</Button>
				)}
			</AlertDescription>
		</Alert>
	);
}

const statusMap = {
	draft: {
		label: "Rascunho",
		icon: CircleDot,
		className: "text-muted-foreground",
	},
	scheduled: { label: "Agendado", icon: Clock, className: "text-gold-ink" },
	pending: { label: "Na fila", icon: Clock, className: "text-gold-ink" },
	queued: {
		label: "Enviando…",
		icon: Loader2,
		className: "text-info",
		spin: true,
	},
	late: { label: "Atrasado", icon: AlertTriangle, className: "text-warning" },
	publishing: {
		label: "Publicando",
		icon: Loader2,
		className: "text-info",
		spin: true,
	},
	processing: {
		label: "Publicando",
		icon: Loader2,
		className: "text-info",
		spin: true,
	},
	published: {
		label: "Publicado",
		icon: CheckCircle2,
		className: "text-success",
	},
	partial: { label: "Parcial", icon: AlertTriangle, className: "text-warning" },
	failed: { label: "Falhou", icon: XCircle, className: "text-destructive" },
	canceled: {
		label: "Cancelado",
		icon: Ban,
		className: "text-muted-foreground",
	},
} as const;

export type AnyStatus = keyof typeof statusMap;

/** Post "agendado" cujo horário já passou: está na fila (ou atrasado, se o worker não pegou). */
export function displayStatus(
	status: AnyStatus,
	scheduledAt: Date | string,
): AnyStatus {
	if (status !== "scheduled" && status !== "pending") return status;
	const late = Date.now() - new Date(scheduledAt).getTime();
	if (late > 5 * 60_000) return "late";
	if (late >= 0) return "queued";
	return status;
}

export function StatusBadge({
	status,
	className,
}: {
	status: AnyStatus;
	className?: string;
}) {
	const s = statusMap[status] ?? statusMap.draft;
	return (
		<Badge
			variant="outline"
			className={cn(
				"gap-1 border-current/30 font-medium",
				s.className,
				className,
			)}
		>
			<s.icon
				className={cn("size-3", "spin" in s && s.spin && "animate-spin")}
			/>
			{s.label}
		</Badge>
	);
}

export function StatusIcon({
	status,
	className,
}: {
	status: AnyStatus;
	className?: string;
}) {
	const s = statusMap[status] ?? statusMap.draft;
	return (
		<s.icon
			className={cn(
				"size-3.5",
				s.className,
				"spin" in s && s.spin && "animate-spin",
				className,
			)}
		/>
	);
}
