"use client";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@autopost/ui/components/avatar";
import { cn } from "@autopost/ui/lib/utils";
import { Check } from "lucide-react";

import { PlatformBadge } from "@/components/platform-icon";
import { plural } from "@/lib/format";
import type { AccountItem, PlatformItem } from "@/lib/types";

type Props = {
	accounts: AccountItem[];
	platforms: PlatformItem[];
	selected: string[];
	onChange: (ids: string[]) => void;
};

/** Cartões que ligam/desligam com um toque: mais simples que arrastar, e funciona igual no celular. */
export function Destinations({
	accounts,
	platforms,
	selected,
	onChange,
}: Props) {
	const platformOf = (id: string) => platforms.find((p) => p.id === id);
	const toggle = (id: string) =>
		onChange(
			selected.includes(id)
				? selected.filter((x) => x !== id)
				: [...selected, id],
		);
	const allSelected =
		accounts.length > 0 && selected.length === accounts.length;

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<p className="text-muted-foreground text-sm">
					{selected.length
						? `${selected.length} de ${plural(accounts.length, "conta marcada", "contas marcadas")}`
						: "Marque uma ou mais contas"}
				</p>
				<button
					type="button"
					onClick={() => onChange(allSelected ? [] : accounts.map((a) => a.id))}
					className="text-gold-ink hover:bg-accent/50 min-h-11 shrink-0 rounded-full px-3 text-sm font-medium"
				>
					{allSelected ? "Limpar" : "Selecionar todas"}
				</button>
			</div>
			<div
				className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:grid-cols-3"
				data-testid="destinations"
			>
				{accounts.map((a) => {
					const on = selected.includes(a.id);
					const platform = platformOf(a.platform);
					const expired = a.status !== "active";
					return (
						<button
							key={a.id}
							type="button"
							aria-pressed={on}
							onClick={() => toggle(a.id)}
							data-testid={`account-${a.id}`}
							className={cn(
								"bg-background/40 hover:border-gold/60 focus-visible:ring-ring relative flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition-all outline-none focus-visible:ring-2",
								on && "border-primary bg-primary/10",
							)}
						>
							<span className="relative shrink-0">
								<PlatformBadge
									platform={a.platform}
									color={platform?.brandColor ?? "#888888"}
								/>
								{a.avatarUrl && (
									<Avatar className="ring-card absolute -right-1.5 -bottom-1.5 size-5 ring-2">
										<AvatarImage src={a.avatarUrl} alt="" />
										<AvatarFallback className="text-[0.5rem]">
											{a.name.slice(0, 1)}
										</AvatarFallback>
									</Avatar>
								)}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-medium">
									{a.name}
								</span>
								<span
									className={cn(
										"block truncate text-xs",
										expired ? "text-destructive" : "text-muted-foreground",
									)}
								>
									{expired
										? "Conexão expirada"
										: (platform?.name ?? a.platform)}
								</span>
							</span>
							<span
								className={cn(
									"flex size-6 shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors",
									on
										? "border-primary bg-primary text-primary-foreground"
										: "border-border",
								)}
								aria-hidden
							>
								{on && <Check className="size-3.5" strokeWidth={3} />}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
