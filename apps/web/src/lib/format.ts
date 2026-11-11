import {
	format,
	formatDistanceToNowStrict,
	isToday,
	isTomorrow,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatBytes(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(sec?: number | null): string {
	if (!sec && sec !== 0) return "—";
	const m = Math.floor(sec / 60);
	const s = Math.round(sec % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
}

/** "Hoje, 18:00" · "Amanhã, 09:30" · "seg, 03 nov · 10:00" */
export function formatWhen(date: Date | string): string {
	const d = new Date(date);
	const time = format(d, "HH:mm");
	if (isToday(d)) return `Hoje, ${time}`;
	if (isTomorrow(d)) return `Amanhã, ${time}`;
	return format(d, "EEE, dd MMM · HH:mm", { locale: ptBR });
}

export function fromNow(date: Date | string): string {
	return formatDistanceToNowStrict(new Date(date), {
		locale: ptBR,
		addSuffix: true,
	});
}

/** "1 conta" · "3 contas" */
export function plural(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}

export function errorMessage(err: unknown): string {
	if (err && typeof err === "object" && "message" in err)
		return String((err as { message: unknown }).message);
	return "Algo deu errado";
}
