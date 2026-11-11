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
	FieldGroup,
	FieldLabel,
} from "@autopost/ui/components/field";
import { Input } from "@autopost/ui/components/input";
import { Spinner } from "@autopost/ui/components/spinner";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export function ChangePasswordDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
}) {
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

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
					onSubmit={async (e) => {
						e.preventDefault();
						const d = new FormData(e.currentTarget);
						const currentPassword = String(d.get("current"));
						const newPassword = String(d.get("next"));
						if (newPassword.length < 8)
							return setError(
								"A nova senha precisa de pelo menos 8 caracteres.",
							);
						if (newPassword !== String(d.get("confirm")))
							return setError("As senhas novas não são iguais.");
						setLoading(true);
						const res = await authClient.changePassword({
							currentPassword,
							newPassword,
							revokeOtherSessions: true,
						});
						setLoading(false);
						if (res.error) {
							setError(
								res.error.code === "INVALID_PASSWORD"
									? "A senha atual está incorreta."
									: (res.error.message ?? "Não foi possível trocar."),
							);
							return;
						}
						toast.success("Senha trocada");
						onOpenChange(false);
					}}
				>
					<DialogHeader className="mb-4">
						<DialogTitle>Trocar senha</DialogTitle>
						<DialogDescription>
							Outros aparelhos conectados com a senha antiga serão
							desconectados.
						</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="pw-current">Senha atual</FieldLabel>
							<Input
								id="pw-current"
								name="current"
								type="password"
								autoComplete="current-password"
								required
								className="h-11"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="pw-next">Nova senha</FieldLabel>
							<Input
								id="pw-next"
								name="next"
								type="password"
								autoComplete="new-password"
								minLength={8}
								required
								className="h-11"
							/>
						</Field>
						<Field data-invalid={Boolean(error) || undefined}>
							<FieldLabel htmlFor="pw-confirm">Repita a nova senha</FieldLabel>
							<Input
								id="pw-confirm"
								name="confirm"
								type="password"
								autoComplete="new-password"
								required
								className="h-11"
							/>
							{error && <FieldError>{error}</FieldError>}
						</Field>
					</FieldGroup>
					<DialogFooter className="mt-6">
						<Button
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
						>
							Cancelar
						</Button>
						<Button type="submit" disabled={loading}>
							{loading && <Spinner />} Salvar nova senha
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
