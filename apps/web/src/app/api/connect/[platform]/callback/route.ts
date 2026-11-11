import {
	appUrl,
	getAppCredentials,
	getProvider,
	type PlatformId,
	redirectUri,
	upsertAccounts,
} from "@autopost/social";
import { type NextRequest, NextResponse } from "next/server";
import { OAUTH_COOKIE } from "@/lib/oauth";
import { auth, db } from "@/services";

/** Retorno do OAuth: valida o state, troca o code por token e salva a(s) conta(s). */
export async function GET(
	req: NextRequest,
	ctx: RouteContext<"/api/connect/[platform]/callback">,
) {
	const { platform } = await ctx.params;
	const origin = appUrl();
	const done = (params: Record<string, string>) => {
		const res = NextResponse.redirect(
			new URL(`/contas?${new URLSearchParams(params)}`, origin),
		);
		res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/connect" });
		return res;
	};

	const session = await auth.api.getSession({ headers: req.headers });
	if (!session?.user) return NextResponse.redirect(new URL("/login", origin));

	const q = req.nextUrl.searchParams;
	const providerError =
		q.get("error_description") ?? q.get("error_message") ?? q.get("error");
	if (providerError) {
		const cancelled = /access_denied|user_denied|cancel/i.test(
			q.get("error") ?? providerError,
		);
		return done({
			erro: cancelled
				? "Conexão cancelada. Tente de novo e clique em “Permitir” na tela da rede."
				: `A rede recusou a conexão: ${providerError.slice(0, 160)}`,
		});
	}

	let saved: { platform?: string; state?: string; verifier?: string } = {};
	try {
		saved = JSON.parse(req.cookies.get(OAUTH_COOKIE)?.value ?? "{}");
	} catch {}
	const code = q.get("code");
	if (
		!code ||
		!saved.state ||
		saved.state !== q.get("state") ||
		saved.platform !== platform
	)
		return done({
			erro: "Sessão de conexão expirada ou inválida. Tente conectar de novo.",
		});

	try {
		const provider = getProvider(platform);
		const app = await getAppCredentials(db, platform);
		if (!app || !provider.exchangeCode)
			throw new Error(`${provider.name} não está configurado`);
		const accounts = await provider.exchangeCode({
			...app,
			code,
			codeVerifier: saved.verifier ?? "",
			redirectUri: redirectUri(platform),
		});
		await upsertAccounts(db, platform as PlatformId, accounts, session.user.id);
		return done({ conectado: provider.name, n: String(accounts.length) });
	} catch (err) {
		console.error(`[connect:${platform}]`, err);
		return done({ erro: `Falha ao conectar: ${(err as Error).message}` });
	}
}
