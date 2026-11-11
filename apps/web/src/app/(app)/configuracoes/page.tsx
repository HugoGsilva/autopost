import { redirect } from "next/navigation";

import { PageContainer, PageHeader } from "@/components/page";
import { requireSession } from "@/lib/session";

import { SettingsView } from "./settings-view";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
	const { user } = await requireSession();
	if (user.role !== "admin") redirect("/painel");
	return (
		<PageContainer>
			<PageHeader
				eyebrow="Configurações"
				title="Ajustes do sistema"
				description="Feito uma vez pelo administrador: chaves de cada rede e acesso da equipe."
			/>
			<SettingsView currentUserId={user.id} />
		</PageContainer>
	);
}
