import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/page";
import { requireSession } from "@/lib/session";

import { AccountsView } from "./accounts-view";

export const metadata = { title: "Contas" };

export default async function ContasPage() {
	const { user } = await requireSession();
	return (
		<PageContainer>
			<PageHeader
				eyebrow="Contas conectadas"
				title="Onde seus vídeos vão aparecer"
				description="Conecte cada rede uma única vez. Depois é só escolher os destinos na hora de postar."
			/>
			<Suspense>
				<AccountsView isAdmin={user.role === "admin"} userId={user.id} />
			</Suspense>
		</PageContainer>
	);
}
