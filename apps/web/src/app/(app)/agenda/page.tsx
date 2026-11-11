import { PageContainer, PageHeader } from "@/components/page";

import { AgendaView } from "./agenda-view";

export const metadata = { title: "Agenda" };

export default function AgendaPage() {
	return (
		<PageContainer className="max-w-7xl">
			<PageHeader
				eyebrow="Agenda"
				title="Seu calendário de conteúdo"
				description="No computador, arraste um post para outro dia para remarcar. Para mudar texto ou horário, use “Editar” no post."
			/>
			<AgendaView />
		</PageContainer>
	);
}
