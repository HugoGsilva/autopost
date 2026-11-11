import { Button } from "@autopost/ui/components/button";
import Link from "next/link";

import { BrandMark } from "@/components/brand";

export default function NotFound() {
	return (
		<main className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 px-4 text-center">
			<BrandMark />
			<div className="space-y-2">
				<p className="eyebrow">Erro 404</p>
				<h1 className="font-display text-4xl">Página não encontrada</h1>
				<p className="text-muted-foreground">
					O endereço pode ter mudado ou o conteúdo foi removido.
				</p>
			</div>
			<Button render={<Link href="/painel" />} nativeButton={false} size="lg">
				Voltar ao painel
			</Button>
		</main>
	);
}
