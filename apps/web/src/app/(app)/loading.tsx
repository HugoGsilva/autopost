import { Skeleton } from "@autopost/ui/components/skeleton";

import { PageContainer } from "@/components/page";

export default function Loading() {
	return (
		<PageContainer>
			<div className="mb-8 space-y-3">
				<Skeleton className="h-3 w-24" />
				<Skeleton className="h-10 w-72 max-w-full" />
				<Skeleton className="h-4 w-96 max-w-full" />
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<Skeleton className="h-40 rounded-2xl" />
				<Skeleton className="h-40 rounded-2xl" />
			</div>
		</PageContainer>
	);
}
