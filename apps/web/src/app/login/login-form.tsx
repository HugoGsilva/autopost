"use client";

import { Button } from "@autopost/ui/components/button";
import { Checkbox } from "@autopost/ui/components/checkbox";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@autopost/ui/components/field";
import { Input } from "@autopost/ui/components/input";
import { Skeleton } from "@autopost/ui/components/skeleton";
import { Spinner } from "@autopost/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BrandMark } from "@/components/brand";
import { authClient } from "@/lib/auth-client";
import { CONTACT, TRIAL } from "@/lib/site";
import { orpc } from "@/utils/orpc";

export function LoginForm({
	initialMode = "login",
}: {
	initialMode?: "login" | "signup";
}) {
	const router = useRouter();
	const setup = useQuery(orpc.team.setupStatus.queryOptions());
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [mode, setMode] = useState(initialMode);
	const [accepted, setAccepted] = useState(false);
	const firstAccess = setup.data && !setup.data.hasUsers;
	const signup = firstAccess || mode === "signup";

	function switchMode(next: "login" | "signup") {
		setMode(next);
		setError(null);
	}

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		const data = new FormData(e.currentTarget);
		const email = String(data.get("email") ?? "").trim();
		const password = String(data.get("password") ?? "");
		if (password.length < 8)
			return setError("A senha precisa ter pelo menos 8 caracteres.");
		if (signup && !accepted)
			return setError(
				"Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.",
			);
		setLoading(true);
		// acceptTerms não faz parte do tipo do Better Auth: o servidor confere no hook de cadastro.
		const signUpBody = {
			name: String(data.get("name") ?? "").trim() || email,
			email,
			password,
			acceptTerms: true,
		};
		const res = signup
			? await authClient.signUp.email(signUpBody)
			: await authClient.signIn.email({ email, password });
		setLoading(false);
		if (res.error) {
			setError(
				res.error.status === 429
					? "Muitas tentativas seguidas. Aguarde um minuto e tente de novo."
					: res.error.status === 401 ||
							res.error.code === "INVALID_EMAIL_OR_PASSWORD"
						? "E-mail ou senha incorretos."
						: (res.error.message ?? "Não foi possível entrar."),
			);
			return;
		}
		router.replace("/painel");
		router.refresh();
	}

	return (
		<div className="w-full max-w-sm">
			<BrandMark className="mb-10" />
			{setup.isPending ? (
				<div className="space-y-4">
					<Skeleton className="h-9 w-2/3" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
				</div>
			) : (
				<>
					<h2 className="font-display text-3xl">
						{firstAccess
							? "Primeiro acesso"
							: signup
								? "Crie sua conta"
								: "Bem-vindo de volta"}
					</h2>
					<p className="text-muted-foreground mt-2 mb-8">
						{firstAccess
							? "Crie a conta de administrador. Depois você convida a equipe em Configurações."
							: signup
								? `Teste grátis por ${TRIAL.days} dias, sem cartão. Depois, é só falar com a gente para continuar.`
								: "Entre para publicar seus vídeos."}
					</p>
					<form onSubmit={onSubmit}>
						<FieldGroup>
							{signup && (
								<Field>
									<FieldLabel htmlFor="name">Seu nome</FieldLabel>
									<Input
										id="name"
										name="name"
										autoComplete="name"
										required
										className="h-11"
									/>
								</Field>
							)}
							<Field>
								<FieldLabel htmlFor="email">E-mail</FieldLabel>
								<Input
									id="email"
									name="email"
									type="email"
									autoComplete="email"
									required
									className="h-11"
								/>
							</Field>
							<Field data-invalid={Boolean(error) || undefined}>
								<FieldLabel htmlFor="password">Senha</FieldLabel>
								<div className="relative">
									<Input
										id="password"
										name="password"
										type={showPassword ? "text" : "password"}
										autoComplete={signup ? "new-password" : "current-password"}
										required
										className="h-11 pr-12"
									/>
									<button
										type="button"
										onClick={() => setShowPassword((v) => !v)}
										aria-label={
											showPassword ? "Esconder senha" : "Mostrar senha"
										}
										className="text-muted-foreground hover:text-foreground absolute top-0 right-0 flex size-11 items-center justify-center rounded-full"
									>
										{showPassword ? (
											<EyeOff className="size-4" />
										) : (
											<Eye className="size-4" />
										)}
									</button>
								</div>
								{error && <FieldError>{error}</FieldError>}
							</Field>
							{signup && (
								<Field orientation="horizontal">
									<Checkbox
										id="accept-terms"
										checked={accepted}
										onCheckedChange={(v) => setAccepted(v === true)}
									/>
									<FieldLabel htmlFor="accept-terms" className="font-normal">
										<span>
											Li e aceito os{" "}
											<Link href="/termos" target="_blank" className="underline">
												Termos de Uso
											</Link>{" "}
											e a{" "}
											<Link
												href="/privacidade"
												target="_blank"
												className="underline"
											>
												Política de Privacidade
											</Link>
										</span>
									</FieldLabel>
								</Field>
							)}
							<Button
								type="submit"
								size="lg"
								className="glow-gold h-11 w-full font-semibold"
								disabled={loading}
							>
								{loading && <Spinner />}
								{signup ? "Criar conta e entrar" : "Entrar"}
							</Button>
							{!firstAccess && (
								<p className="text-muted-foreground text-center text-sm">
									{signup ? (
										<>
											Já tem conta?{" "}
											<button
												type="button"
												className="text-foreground underline"
												onClick={() => switchMode("login")}
											>
												Entrar
											</button>
										</>
									) : (
										<>
											Ainda não tem conta?{" "}
											<button
												type="button"
												className="text-foreground underline"
												onClick={() => switchMode("signup")}
											>
												Criar conta grátis
											</button>
										</>
									)}
								</p>
							)}
							{!signup && (
								<p className="text-muted-foreground text-center text-sm">
									Esqueceu a senha? Fale com a IA2S em{" "}
									<a href={`mailto:${CONTACT.email}`} className="underline">
										{CONTACT.email}
									</a>
									.
								</p>
							)}
						</FieldGroup>
					</form>
				</>
			)}
		</div>
	);
}
