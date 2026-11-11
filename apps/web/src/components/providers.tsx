"use client";

import { Toaster } from "@autopost/ui/components/sonner";
import { TooltipProvider } from "@autopost/ui/components/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";

import { getQueryClient } from "@/utils/orpc";

import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
	const queryClient = getQueryClient();

	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="dark"
			enableSystem
			disableTransitionOnChange
		>
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>{children}</TooltipProvider>
			</QueryClientProvider>
			<Toaster richColors position="top-center" />
		</ThemeProvider>
	);
}
