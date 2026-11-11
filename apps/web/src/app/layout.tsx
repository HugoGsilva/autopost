import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";

const manrope = Manrope({
	variable: "--font-manrope",
	subsets: ["latin"],
});

const fraunces = Fraunces({
	variable: "--font-fraunces",
	subsets: ["latin"],
	axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
	title: { default: "IA2S Cast", template: "%s · IA2S Cast" },
	description: "Publique seus vídeos em todas as redes de uma vez.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="pt-BR" suppressHydrationWarning>
			<body className={`${manrope.variable} ${fraunces.variable} antialiased`}>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
