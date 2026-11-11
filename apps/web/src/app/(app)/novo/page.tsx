import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/page";

import { Composer } from "./composer";

export const metadata = { title: "Novo post" };

export default function NovoPostPage() {
	return (
		<PageContainer className="max-w-7xl">
			<PageHeader
				eyebrow="Novo post"
				title="Envie uma vez, publique em todo lugar"
				description="Arraste o vídeo, escolha os destinos, escreva a legenda e defina quando sai."
			/>
			<Suspense>
				<Composer />
			</Suspense>
		</PageContainer>
	);
}
