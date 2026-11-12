"use client";

import { Avatar, AvatarFallback } from "@autopost/ui/components/avatar";
import { Button } from "@autopost/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@autopost/ui/components/dropdown-menu";
import { cn } from "@autopost/ui/lib/utils";
import {
	CalendarDays,
	KeyRound,
	LayoutDashboard,
	ListVideo,
	LogOut,
	Moon,
	Plus,
	Settings,
	Sun,
	Trash2,
	UsersRound,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { BrandMark } from "./brand";
import { ChangePasswordDialog } from "./change-password-dialog";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { TrialBanner } from "./trial-banner";
import { WorkerBanner } from "./worker-banner";

type NavItem = {
	href: Route;
	label: string;
	icon: typeof LayoutDashboard;
	admin?: boolean;
};

const nav: NavItem[] = [
	{ href: "/painel", label: "Painel", icon: LayoutDashboard },
	{ href: "/agenda", label: "Agenda", icon: CalendarDays },
	{ href: "/posts", label: "Publicações", icon: ListVideo },
	{ href: "/contas", label: "Contas", icon: UsersRound },
	{
		href: "/configuracoes",
		label: "Configurações",
		icon: Settings,
		admin: true,
	},
];

export type ShellUser = {
	name: string;
	email: string;
	role: string;
	/** Fim do teste grátis (ISO); null = sem prazo. */
	accessUntil: string | null;
};

export function AppShell({
	user,
	children,
}: {
	user: ShellUser;
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const items = nav.filter((i) => !i.admin || user.role === "admin");
	const isActive = (href: string) =>
		pathname === href || pathname.startsWith(`${href}/`);

	return (
		<div className="bg-aura min-h-svh md:grid md:grid-cols-[4.75rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]">
			{/* Tablet: só ícones (com dica); desktop largo: ícone + texto */}
			<aside className="border-sidebar-border bg-sidebar/70 sticky top-0 hidden h-svh flex-col border-r px-3 py-5 backdrop-blur md:flex">
				<Link href="/painel" className="px-1 xl:px-2" aria-label="Início">
					<BrandMark className="xl:hidden" compact />
					<BrandMark className="hidden xl:inline-flex" />
				</Link>
				<Button
					render={<Link href="/novo" />}
					nativeButton={false}
					size="lg"
					aria-label="Novo post"
					className="glow-gold mt-7 h-11 w-full px-0 font-semibold xl:px-2.5"
				>
					<Plus /> <span className="hidden xl:inline">Novo post</span>
				</Button>
				<nav className="mt-6 flex flex-col gap-1">
					{items.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							title={item.label}
							className={cn(
								"text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex min-h-11 items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors xl:justify-start",
								isActive(item.href) &&
									"bg-sidebar-accent text-sidebar-accent-foreground",
							)}
						>
							<item.icon
								className={cn(
									"size-5 xl:size-4",
									isActive(item.href) && "text-gold-ink",
								)}
							/>
							<span className="hidden xl:inline">{item.label}</span>
						</Link>
					))}
				</nav>
				<div className="mt-auto">
					<UserMenu user={user} />
				</div>
			</aside>

			<div className="flex min-h-svh flex-col pb-20 md:pb-0">
				<header className="bg-background/80 sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur md:hidden">
					<Link href="/painel">
						<BrandMark />
					</Link>
					<UserMenu user={user} compact />
				</header>
				<TrialBanner accessUntil={user.accessUntil} />
				<WorkerBanner isAdmin={user.role === "admin"} />
				<main className="min-w-0 flex-1 overflow-x-clip">{children}</main>
			</div>

			<nav
				className={cn(
					"bg-background/95 fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur md:hidden",
					// No compositor o rodapé é da barra "Publicar" (o "voltar" do celular e o topo continuam disponíveis)
					pathname.startsWith("/novo") && "hidden",
				)}
			>
				{[
					nav[0]!,
					nav[1]!,
					{ href: "/novo" as Route, label: "Novo", icon: Plus },
					nav[2]!,
					nav[3]!,
				].map((item) => {
					const isNew = item.href === "/novo";
					return (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"text-muted-foreground flex flex-col items-center gap-1 py-1 text-[0.68rem]",
								isActive(item.href) && "text-foreground",
							)}
						>
							<span
								className={cn(
									"flex size-8 items-center justify-center rounded-full",
									isNew && "glow-gold bg-primary text-primary-foreground",
								)}
							>
								<item.icon
									className={cn(
										"size-4.5",
										!isNew && isActive(item.href) && "text-gold-ink",
									)}
								/>
							</span>
							{item.label}
						</Link>
					);
				})}
			</nav>
		</div>
	);
}

function UserMenu({ user, compact }: { user: ShellUser; compact?: boolean }) {
	const router = useRouter();
	const { resolvedTheme, setTheme } = useTheme();
	const [changingPassword, setChangingPassword] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const initials = user.name
		.split(" ")
		.map((p) => p[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();

	return (
		<>
			<ChangePasswordDialog
				open={changingPassword}
				onOpenChange={setChangingPassword}
			/>
			<DeleteAccountDialog open={deleting} onOpenChange={setDeleting} />
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							className={cn(
								"h-auto gap-3 px-2 py-2",
								compact
									? "rounded-full"
									: "w-full justify-center xl:justify-start",
							)}
						/>
					}
				>
					<Avatar className="size-8">
						<AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
							{initials}
						</AvatarFallback>
					</Avatar>
					{!compact && (
						<span className="hidden min-w-0 text-left xl:block">
							<span className="block truncate text-sm font-medium">
								{user.name}
							</span>
							<span className="text-muted-foreground block truncate text-xs">
								{user.role === "admin" ? "Administrador" : "Membro"}
							</span>
						</span>
					)}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuGroup>
						<DropdownMenuLabel className="truncate">
							{user.email}
						</DropdownMenuLabel>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={() =>
							setTheme(resolvedTheme === "dark" ? "light" : "dark")
						}
					>
						{resolvedTheme === "dark" ? <Sun /> : <Moon />}
						{resolvedTheme === "dark" ? "Tema claro" : "Tema escuro"}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setChangingPassword(true)}>
						<KeyRound /> Trocar senha
					</DropdownMenuItem>
					{user.role === "admin" && (
						<DropdownMenuItem onClick={() => router.push("/configuracoes")}>
							<Settings /> Configurações
						</DropdownMenuItem>
					)}
					{user.role !== "admin" && (
						<DropdownMenuItem onClick={() => setDeleting(true)}>
							<Trash2 /> Excluir minha conta
						</DropdownMenuItem>
					)}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onClick={() =>
							authClient.signOut({
								fetchOptions: { onSuccess: () => router.replace("/login") },
							})
						}
					>
						<LogOut /> Sair
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}
