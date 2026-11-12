"use client";

import { TIKTOK_PRIVACY_LABELS } from "@autopost/social/tiktok-rules";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@autopost/ui/components/alert";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@autopost/ui/components/avatar";
import { Checkbox } from "@autopost/ui/components/checkbox";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "@autopost/ui/components/field";
import {
	RadioGroup,
	RadioGroupItem,
} from "@autopost/ui/components/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@autopost/ui/components/select";
import { Skeleton } from "@autopost/ui/components/skeleton";
import { Switch } from "@autopost/ui/components/switch";
import type { UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle, Inbox } from "lucide-react";

import type { AccountItem } from "@/lib/types";
import type { client } from "@/utils/orpc";

export type CreatorInfo = Awaited<
	ReturnType<typeof client.accounts.tiktokCreatorInfo>
>;

const MUSIC_URL =
	"https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
const BRANDED_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";

/**
 * Bloco do TikTok no compositor, seguindo as regras de tela do Direct Post:
 * conta que vai publicar, privacidade sem valor padrão, interações desmarcadas,
 * divulgação de conteúdo comercial e o aviso de Music Usage Confirmation.
 */
export function TikTokSettings({
	account,
	options,
	creator,
	onChange,
}: {
	account: AccountItem;
	options: Record<string, string>;
	creator: UseQueryResult<CreatorInfo>;
	onChange: (options: Record<string, string>) => void;
}) {
	const set = (patch: Record<string, string>) =>
		onChange({ ...options, ...patch });
	const on = (key: string) => options[key] === "true";
	const mode = options.mode === "inbox" ? "inbox" : "direct";
	const commercial = on("commercial");
	const brandContent = commercial && on("brandContent");
	const brandOrganic = commercial && on("brandOrganic");
	const id = (k: string) => `tt-${account.id}-${k}`;

	return (
		<div className="space-y-5" data-testid={`tiktok-settings-${account.id}`}>
			<RadioGroup
				value={mode}
				onValueChange={(v) => set({ mode: String(v) })}
				aria-label="Como enviar para o TikTok"
				className="sm:grid-cols-2"
			>
				<Field orientation="horizontal" className="rounded-xl border p-3">
					<RadioGroupItem value="direct" id={id("direct")} />
					<FieldContent>
						<FieldLabel htmlFor={id("direct")}>Publicar direto</FieldLabel>
						<FieldDescription>
							O vídeo sai no perfil com as opções abaixo.
						</FieldDescription>
					</FieldContent>
				</Field>
				<Field orientation="horizontal" className="rounded-xl border p-3">
					<RadioGroupItem value="inbox" id={id("inbox")} />
					<FieldContent>
						<FieldLabel htmlFor={id("inbox")}>Enviar como rascunho</FieldLabel>
						<FieldDescription>
							Você finaliza e publica no app do TikTok.
						</FieldDescription>
					</FieldContent>
				</Field>
			</RadioGroup>

			{mode === "inbox" ? (
				<p className="text-muted-foreground flex gap-2 text-sm">
					<Inbox className="text-gold-ink mt-0.5 size-4 shrink-0" />
					O vídeo vai para a caixa de rascunhos do TikTok. Você recebe uma
					notificação no app para revisar, escolher a privacidade e publicar em
					até 24 horas.
				</p>
			) : creator.isPending ? (
				<div className="space-y-3">
					<Skeleton className="h-12 rounded-xl" />
					<Skeleton className="h-10 rounded-xl" />
					<Skeleton className="h-24 rounded-xl" />
				</div>
			) : creator.isError || !creator.data?.ok ? (
				<Alert variant="destructive">
					<AlertTriangle />
					<AlertTitle>Não dá para publicar no TikTok agora</AlertTitle>
					<AlertDescription>
						{creator.data && !creator.data.ok
							? creator.data.message
							: "Não conseguimos falar com o TikTok. Tente de novo em instantes."}
					</AlertDescription>
				</Alert>
			) : (
				<DirectPost
					info={creator.data}
					options={options}
					set={set}
					id={id}
					commercial={commercial}
					brandContent={brandContent}
					brandOrganic={brandOrganic}
				/>
			)}
		</div>
	);
}

function DirectPost({
	info,
	options,
	set,
	id,
	commercial,
	brandContent,
	brandOrganic,
}: {
	info: Extract<CreatorInfo, { ok: true }>;
	options: Record<string, string>;
	set: (patch: Record<string, string>) => void;
	id: (k: string) => string;
	commercial: boolean;
	brandContent: boolean;
	brandOrganic: boolean;
}) {
	const privacyItems = info.privacyOptions.map((value) => ({
		value,
		label: TIKTOK_PRIVACY_LABELS[value] ?? value,
	}));
	const interactions = [
		{ key: "allowComment", label: "Comentários", off: info.commentDisabled },
		{ key: "allowDuet", label: "Duet", off: info.duetDisabled },
		{ key: "allowStitch", label: "Stitch", off: info.stitchDisabled },
	];
	const privateOnly = options.privacy === "SELF_ONLY";

	return (
		<>
			<div className="bg-muted/40 flex items-center gap-3 rounded-xl p-3">
				<Avatar className="size-10">
					{info.avatarUrl && <AvatarImage src={info.avatarUrl} alt="" />}
					<AvatarFallback>{info.nickname.slice(0, 1)}</AvatarFallback>
				</Avatar>
				<div className="min-w-0">
					<p className="text-muted-foreground text-xs">Publicando no TikTok como</p>
					<p className="truncate font-medium">
						{info.nickname}
						{info.username && (
							<span className="text-muted-foreground font-normal">
								{" "}
								@{info.username}
							</span>
						)}
					</p>
				</div>
			</div>

			<Field>
				<FieldLabel>Quem pode ver este vídeo</FieldLabel>
				<Select
					items={privacyItems}
					value={options.privacy || null}
					onValueChange={(v) => set({ privacy: String(v) })}
				>
					<SelectTrigger
						className="w-full"
						aria-label="Quem pode ver este vídeo"
						data-testid="tiktok-privacy"
					>
						<SelectValue placeholder="Escolha quem pode ver" />
					</SelectTrigger>
					<SelectContent>
						{privacyItems.map((p) => (
							<SelectItem
								key={p.value}
								value={p.value}
								disabled={brandContent && p.value === "SELF_ONLY"}
							>
								{p.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{brandContent && (
					<FieldDescription>
						Conteúdo de marca não pode ser publicado como “Só eu”.
					</FieldDescription>
				)}
			</Field>

			<fieldset className="space-y-2">
				<legend className="mb-2 text-sm font-medium">Permitir</legend>
				<div className="flex flex-wrap gap-x-6 gap-y-2">
					{interactions.map((i) => (
						<Field key={i.key} orientation="horizontal" className="w-auto">
							<Checkbox
								id={id(i.key)}
								checked={!i.off && options[i.key] === "true"}
								disabled={i.off}
								onCheckedChange={(v) => set({ [i.key]: String(v === true) })}
							/>
							<FieldLabel htmlFor={id(i.key)} className="font-normal">
								{i.label}
							</FieldLabel>
						</Field>
					))}
				</div>
				{interactions.some((i) => i.off) && (
					<p className="text-muted-foreground text-xs">
						Opções em cinza estão desativadas nas configurações da sua conta do
						TikTok.
					</p>
				)}
			</fieldset>

			<div className="space-y-3 rounded-xl border p-3">
				<div className="flex items-start justify-between gap-4">
					<div>
						<p className="text-sm font-medium">Divulgar conteúdo comercial</p>
						<p className="text-muted-foreground text-xs">
							Ative se o vídeo promove você, uma marca, um produto ou um
							serviço.
						</p>
					</div>
					<Switch
						checked={commercial}
						onCheckedChange={(v) => set({ commercial: String(v) })}
						aria-label="Divulgar conteúdo comercial"
					/>
				</div>
				{commercial && (
					<div className="space-y-3 border-t pt-3">
						<Field orientation="horizontal">
							<Checkbox
								id={id("brandOrganic")}
								checked={brandOrganic}
								onCheckedChange={(v) =>
									set({ brandOrganic: String(v === true) })
								}
							/>
							<FieldContent>
								<FieldLabel htmlFor={id("brandOrganic")}>Sua marca</FieldLabel>
								<FieldDescription>
									Você está promovendo você mesmo ou o seu próprio negócio.
								</FieldDescription>
							</FieldContent>
						</Field>
						<Field orientation="horizontal">
							<Checkbox
								id={id("brandContent")}
								checked={brandContent}
								disabled={privateOnly}
								onCheckedChange={(v) =>
									set({ brandContent: String(v === true) })
								}
							/>
							<FieldContent>
								<FieldLabel htmlFor={id("brandContent")}>
									Conteúdo de marca
								</FieldLabel>
								<FieldDescription>
									{privateOnly
										? "Indisponível com “Só eu”: conteúdo de marca precisa ser visível."
										: "Você está promovendo outra marca ou um terceiro."}
								</FieldDescription>
							</FieldContent>
						</Field>
						<p
							className={
								brandOrganic || brandContent
									? "text-muted-foreground text-xs"
									: "text-destructive text-xs"
							}
						>
							{brandContent
								? "Seu vídeo será marcado como “Parceria paga”."
								: brandOrganic
									? "Seu vídeo será marcado como “Conteúdo promocional”."
									: "Indique se o conteúdo promove você, uma marca de terceiros ou os dois."}
						</p>
					</div>
				)}
			</div>

			<p className="text-muted-foreground text-xs" data-testid="tiktok-consent">
				Ao publicar, você concorda com a{" "}
				{brandContent && (
					<>
						<a
							href={BRANDED_URL}
							target="_blank"
							rel="noreferrer"
							className="text-foreground underline"
						>
							Política de Conteúdo de Marca
						</a>{" "}
						e a{" "}
					</>
				)}
				<a
					href={MUSIC_URL}
					target="_blank"
					rel="noreferrer"
					className="text-foreground underline"
				>
					Music Usage Confirmation
				</a>{" "}
				do TikTok.
			</p>
		</>
	);
}
