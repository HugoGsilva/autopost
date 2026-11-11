"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertOctagon } from "lucide-react";

import { orpc } from "@/utils/orpc";

/** Faixa de alerta quando o serviço que publica (worker) parou: sem isso, posts ficam "agendados" para sempre. */
export function WorkerBanner({ isAdmin }: { isAdmin: boolean }) {
	const status = useQuery({
		...orpc.system.status.queryOptions(),
		refetchInterval: 30_000,
		retry: false,
	});
	if (!status.data || status.data.worker.online) return null;
	return (
		<div
			role="alert"
			data-testid="worker-banner"
			className="border-destructive/30 bg-destructive/10 flex items-start gap-3 border-b px-4 py-3 text-sm md:px-8"
		>
			<AlertOctagon className="text-destructive mt-0.5 size-4 shrink-0" />
			<p>
				<span className="text-destructive font-semibold">
					Publicação pausada.
				</span>{" "}
				{isAdmin
					? "O serviço que envia os posts (worker) não está respondendo. Verifique o container “worker” no servidor."
					: "O serviço que envia os posts está fora do ar. Os posts agendados saem assim que ele voltar — avise o administrador."}
			</p>
		</div>
	);
}
