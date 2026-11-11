import {
	appUrl,
	getAppCredentials,
	getProvider,
	pkcePair,
	randomToken,
	redirectUri,
} from "@autopost/social";
import { type NextRequest, NextResponse } from "next/server";
import { OAUTH_COOKIE } from "@/lib/oauth";
import { auth, db } from "@/services";

/** Inicia o login na plataforma: guarda state/PKCE num cookie e redireciona. */
export async function GET(
	req: NextRequest,
	ctx: RouteContext<"/api/connect/[platform]">,
) {
	const { platform } = await ctx.params;
	const back = (msg: string) =>
		NextResponse.redirect(
			new URL(`/contas?erro=${encodeURIComponent(msg)}`, appUrl()),
		);

	const session = await auth.api.getSession({ headers: req.headers });
	if (!session?.user) return NextResponse.redirect(new URL("/login", appUrl()));

	let provider: ReturnType<typeof getProvider>;
	try {
		provider = getProvider(platform);
	} catch {
		return back("Plataforma desconhecida");
	}
	if (provider.auth !== "oauth" || !provider.getAuthUrl)
		return back(`${provider.name} não usa login OAuth`);

	const app = await getAppCredentials(db, platform);
	if (!app)
		return back(
			`${provider.name} ainda não foi configurado. Um administrador precisa preencher as chaves em Configurações.`,
		);

	const state = randomToken(24);
	const { verifier, challenge } = pkcePair();
	const url = provider.getAuthUrl({
		...app,
		redirectUri: redirectUri(platform),
		state,
		codeChallenge: challenge,
	});

	const res = NextResponse.redirect(url);
	res.cookies.set(OAUTH_COOKIE, JSON.stringify({ platform, state, verifier }), {
		httpOnly: true,
		sameSite: "lax",
		secure: appUrl().startsWith("https:"),
		path: "/api/connect",
		maxAge: 600,
	});
	return res;
}
