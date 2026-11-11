"use client";

import { Button } from "@autopost/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@autopost/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldLabel,
} from "@autopost/ui/components/field";
import { Input } from "@autopost/ui/components/input";
import { Spinner } from "@autopost/ui/components/spinner";
import { Textarea } from "@autopost/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { errorMessage, formatWhen } from "@/lib/format";
import type { PostItem } from "@/lib/types";
import { orpc } from "@/utils/orpc";

import { PlatformIcon } from "./platform-icon";

/** Editar legenda e horário de um post agendado (funciona igual no celular). */
export function EditPostDialog({
	post,
	open,
	onOpenChange,
}: {
	post: PostItem;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const qc = useQueryClient();
	const [caption, setCaption] = useState(post.caption);
	const [date, setDate] = useState("");
	const [time, setTime] = useState("");
	const [targetCaptions, setTargetCaptions] = useState<Record<string, string>>(
		{},
	);

	useEffect(() => {
		if (!open) return;
		const d = new Date(post.scheduledAt);
		setCaption(post.caption);
		setDate(format(d, "yyyy-MM-dd"));
		setTime(format(d, "HH:mm"));
		setTargetCaptions(
			Object.fromEntries(
				post.targets
					.filter((t) => t.caption)
					.map((t) => [t.id, t.caption ?? ""]),
			),
		);
	}, [open, post]);

	const when = date && time ? new Date(`${date}T${time}`) : null;
	const inPast = when ? when.getTime() < Date.now() : false;

	const update = useMutation(
		orpc.posts.update.mutationOptions({
			onSuccess: () => {
				toast.success(
					when ? `Post atualizado para ${formatWhen(when)}` : "Post atualizado",
				);
				qc.invalidateQueries({ queryKey: orpc.posts.key() });
				onOpenChange(false);
			},
			onError: (e) => toast.error(errorMessage(e)),
		}),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (!when || inPast) return;
						update.mutate({
							id: post.id,
							caption,
							scheduledAt: when,
							targetCaptions,
						});
					}}
				>
					<DialogHeader className="mb-4">
						<DialogTitle>Editar post</DialogTitle>
						<DialogDescription>
							Mude o texto ou o horário. O vídeo e os destinos continuam os
							mesmos.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<Field>
							<FieldLabel htmlFor="edit-caption">Legenda</FieldLabel>
							<Textarea
								id="edit-caption"
								value={caption}
								onChange={(e) => setCaption(e.target.value)}
								className="min-h-28"
								data-testid="edit-caption"
							/>
						</Field>
						{Object.keys(targetCaptions).length > 0 && (
							<div className="space-y-3">
								{post.targets
									.filter((t) => t.id in targetCaptions)
									.map((t) => (
										<Field key={t.id}>
											<FieldLabel className="gap-1.5">
												<PlatformIcon
													platform={t.platform}
													className="size-3.5"
												/>{" "}
												Legenda própria em {t.accountName}
											</FieldLabel>
											<Textarea
												value={targetCaptions[t.id]}
												onChange={(e) =>
													setTargetCaptions((c) => ({
														...c,
														[t.id]: e.target.value,
													}))
												}
												className="min-h-20"
											/>
										</Field>
									))}
							</div>
						)}
						<div className="grid grid-cols-2 gap-3">
							<Field>
								<FieldLabel htmlFor="edit-date">Dia</FieldLabel>
								<Input
									id="edit-date"
									type="date"
									value={date}
									min={format(new Date(), "yyyy-MM-dd")}
									onChange={(e) => setDate(e.target.value)}
									className="h-11"
									data-testid="edit-date"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="edit-time">Horário</FieldLabel>
								<Input
									id="edit-time"
									type="time"
									value={time}
									onChange={(e) => setTime(e.target.value)}
									className="h-11"
									data-testid="edit-time"
								/>
							</Field>
						</div>
						{inPast && (
							<FieldDescription className="text-destructive">
								Esse horário já passou.
							</FieldDescription>
						)}
					</div>
					<DialogFooter className="mt-6">
						<Button
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							disabled={!when || inPast || update.isPending}
							data-testid="edit-save"
						>
							{update.isPending && <Spinner />} Salvar alterações
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
