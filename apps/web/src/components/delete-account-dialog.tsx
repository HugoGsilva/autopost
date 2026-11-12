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
	FieldError,
	FieldLabel,
} from "@autopost/ui/components/field";
import { Input } from "@autopost/ui/components/input";
import { Spinner } from "@autopost/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { orpc } from "@/utils/orpc";

/** Exclusão da própria conta (LGPD): apaga posts, vídeos e contas conectadas. */
export function DeleteAccountDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
}) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const remove = useMutation(
		orpc.team.deleteMe.mutationOptions({
			onSuccess: () => router.replace("/"),
			onError: (e) => setError(e.message),
		}),
	);

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				setError(null);
				onOpenChange(o);
			}}
		>
			<DialogContent className="sm:max-w-md">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						setError(null);
						const password = String(new FormData(e.currentTarget).get("pw"));
						remove.mutate({ password });
					}}
				>
					<DialogHeader className="mb-4">
						<DialogTitle>Excluir minha conta</DialogTitle>
						<DialogDescription>
							Apaga de vez seu cadastro, as publicações, os vídeos enviados e as
							conexões com as redes. Os posts que já saíram nas redes continuam
							lá. Não dá para desfazer.
						</DialogDescription>
					</DialogHeader>
					<Field data-invalid={Boolean(error) || undefined}>
						<FieldLabel htmlFor="delete-pw">Confirme sua senha</FieldLabel>
						<Input
							id="delete-pw"
							name="pw"
							type="password"
							autoComplete="current-password"
							required
							className="h-11"
						/>
						{error && <FieldError>{error}</FieldError>}
					</Field>
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
							variant="destructive"
							disabled={remove.isPending}
						>
							{remove.isPending && <Spinner />} Excluir para sempre
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
