import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/session";

export default async function AppLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { user } = await requireSession();
	return (
		<AppShell user={{ name: user.name, email: user.email, role: user.role }}>
			{children}
		</AppShell>
	);
}
