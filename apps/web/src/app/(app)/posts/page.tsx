import { Button } from "@autopost/ui/components/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/page";

import { PostsList } from "./posts-list";

export const metadata = { title: "Publicações" };

export default function PostsPage() {
	return (
		<PageContainer>
			<PageHeader
				eyebrow="Publicações"
				title="Tudo o que saiu e o que vai sair"
				description="Status de cada rede em tempo real. Toque em uma rede para ver detalhes; se algo falhar, o motivo e a solução aparecem no próprio post."
				actions={
					<Button render={<Link href="/novo" />} nativeButton={false}>
						<Plus /> Novo post
					</Button>
				}
			/>
			<Suspense>
				<PostsList />
			</Suspense>
		</PageContainer>
	);
}
