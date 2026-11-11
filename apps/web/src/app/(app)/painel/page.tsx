import { PageContainer } from "@/components/page";
import { requireSession } from "@/lib/session";

import { Dashboard } from "./dashboard";

export const metadata = { title: "Painel" };

export default async function PainelPage() {
	const { user } = await requireSession();
	return (
		<PageContainer>
			<Dashboard
				name={user.name.split(" ")[0] ?? user.name}
				isAdmin={user.role === "admin"}
			/>
		</PageContainer>
	);
}
