"use client";

import { Button } from "@autopost/ui/components/button";
import { useEffect } from "react";

export default function ErrorPage({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<main className="flex min-h-[60svh] flex-col items-center justify-center gap-6 px-4 text-center">
			<div className="space-y-2">
				<p className="eyebrow">Algo deu errado</p>
				<h1 className="font-display text-3xl">
					Não conseguimos carregar esta tela
				</h1>
				<p className="text-muted-foreground">
					Tente de novo. Se continuar, avise o administrador.
				</p>
				{error.digest && (
					<p className="text-muted-foreground font-mono text-xs">
						Código: {error.digest}
					</p>
				)}
			</div>
			<Button onClick={reset} size="lg">
				Tentar de novo
			</Button>
		</main>
	);
}
