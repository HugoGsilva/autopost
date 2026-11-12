import { expect, type Page, test } from "@playwright/test";
import { addDays, format, startOfDay } from "date-fns";

import {
	ADMIN,
	destination,
	dragTo,
	login,
	MEMBER,
	postIdFromUrl,
	rpc,
	rpcRaw,
	TRIAL_USER,
	uploadSample,
} from "./helpers";

test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
	page = await browser.newPage();
});

test.afterAll(async () => {
	await page.close();
});

test("site público abre sem login: home, termos, privacidade e verificação do TikTok", async () => {
	await page.goto("/");
	await expect(page).toHaveURL("/");
	await expect(
		page.getByRole("heading", { name: /Um vídeo\.\s*Todas as redes\./ }),
	).toBeVisible();
	await expect(page.locator("#redes").getByText("TikTok")).toBeVisible();
	for (const [path, heading] of [
		["/termos", "Termos de Uso"],
		["/privacidade", "Política de Privacidade"],
		["/contato", "Fale com a IA2S"],
	] as const) {
		await page.goto(path);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
		await expect(
			page
				.getByRole("contentinfo")
				.getByRole("link", { name: "Termos de Uso" }),
		).toBeVisible();
	}
	const tiktok = await page.request.get(
		"/tiktoke68B5RzTGOtg2sgZyElCJFsyRJVkzpjT.txt",
	);
	expect(tiktok.status()).toBe(200);
	expect(await tiktok.text()).toContain("tiktok-developers-site-verification=");
});

test("primeiro acesso cria o administrador", async () => {
	await page.goto("/login");
	await expect(
		page.getByRole("heading", { name: "Primeiro acesso" }),
	).toBeVisible();
	await page.getByLabel("Seu nome").fill(ADMIN.name);
	await page.getByLabel("E-mail").fill(ADMIN.email);
	await page.getByLabel("Senha", { exact: true }).fill(ADMIN.password);
	// sem aceitar os termos não cria a conta
	await page.getByRole("button", { name: "Criar conta e entrar" }).click();
	await expect(page.getByText("aceite os Termos de Uso")).toBeVisible();
	await page.getByRole("checkbox").click();
	await page.getByRole("button", { name: "Criar conta e entrar" }).click();
	await expect(page).toHaveURL(/\/painel/);
	await expect(page.getByRole("heading", { name: "Olá, Ana" })).toBeVisible();
	await expect(page.getByText("Primeiros passos")).toBeVisible();
	// worker está rodando: não pode aparecer o alerta de publicação pausada
	await expect(page.getByTestId("worker-banner")).toHaveCount(0);
});

test("cadastro público exige aceitar os termos", async ({ request }) => {
	const res = await request.post("/api/auth/sign-up/email", {
		data: { name: "Sem aceite", email: "sem@x.com", password: "12345678910" },
		headers: { origin: "http://localhost:3100" },
	});
	expect(res.status()).toBe(400);
	expect(await res.text()).toContain("aceite os Termos");
	// ninguém se cadastra como admin nem define o próprio prazo
	const sneaky = await request.post("/api/auth/sign-up/email", {
		data: {
			name: "Esperto",
			email: "esperto@x.com",
			password: "12345678910",
			acceptTerms: true,
			role: "admin",
			accessUntil: "2099-01-01",
		},
		headers: { origin: "http://localhost:3100" },
	});
	expect(sneaky.status()).toBe(400);
});

test("cabeçalhos de segurança e API protegida contra CSRF", async () => {
	const res = await page.request.get("/login");
	expect(res.headers()["x-frame-options"]).toBe("DENY");
	expect(res.headers()["x-content-type-options"]).toBe("nosniff");
	expect(res.headers()["content-security-policy"]).toContain(
		"frame-ancestors 'none'",
	);
	expect(res.headers()["x-powered-by"]).toBeUndefined();

	// sem o header anti-CSRF, chamadas são recusadas mesmo com cookie de sessão
	const noCsrf = await rpcRaw(page, "posts/stats", {}, false);
	expect(noCsrf.status()).toBe(403);
	// a referência da API não fica exposta em produção
	const ref = await page.request.get("/api/rpc/api-reference");
	expect(ref.status()).toBe(404);
});

test("admin configura o Instagram e o login OAuth aponta para o Instagram", async () => {
	await page.goto("/configuracoes");
	const card = page.getByTestId("config-instagram");
	await card
		.getByRole("button", { name: /Instagram/ })
		.first()
		.click();
	await card.getByLabel("Instagram App ID").fill("123456789");
	await card.getByLabel("Instagram App Secret").fill("segredo-do-app");
	await card.getByRole("button", { name: "Salvar" }).click();
	await expect(card.getByText("Configurado")).toBeVisible();

	const res = await page.request.get("/api/connect/instagram", {
		maxRedirects: 0,
	});
	expect(res.status()).toBe(307);
	const location = new URL(res.headers().location!);
	expect(location.origin + location.pathname).toBe(
		"https://www.instagram.com/oauth/authorize",
	);
	expect(location.searchParams.get("client_id")).toBe("123456789");
	expect(location.searchParams.get("redirect_uri")).toBe(
		"http://localhost:3100/api/connect/instagram/callback",
	);
	expect(location.searchParams.get("scope")).toContain(
		"instagram_business_content_publish",
	);

	// callback forjado (state errado) é recusado
	const bad = await page.request.get(
		"/api/connect/instagram/callback?code=x&state=forjado",
		{ maxRedirects: 0 },
	);
	expect(bad.headers().location).toContain("/contas?erro=");
	// usuário cancelou na tela da rede: mensagem amigável
	const denied = await page.request.get(
		"/api/connect/instagram/callback?error=access_denied",
		{ maxRedirects: 0 },
	);
	expect(
		decodeURIComponent(denied.headers().location!.replace(/\+/g, " ")),
	).toContain("Conexão cancelada");
});

test("o segredo salvo não volta para a interface", async () => {
	const data = await rpc<{
		platforms: { id: string; clientId: string | null }[];
	}>(page, "platforms/list");
	const ig = data.platforms.find((p) => p.id === "instagram")!;
	expect(ig.clientId).toBe("123456789");
	expect(JSON.stringify(data)).not.toContain("segredo-do-app");
});

test("servidor do Bluesky não pode apontar para a rede interna (SSRF)", async () => {
	for (const service of [
		"http://127.0.0.1:5432",
		"https://10.0.0.5",
		"https://localhost",
	]) {
		const res = await rpcRaw(page, "accounts/connectManual", {
			platform: "bluesky",
			fields: { identifier: "a.bsky.social", password: "xxxx-xxxx", service },
		});
		expect(res.status()).toBe(400);
		expect(await res.text()).toMatch(
			/https:\/\/ válido|não permitido|não encontrado/,
		);
	}
});

async function connectDemo(name: string) {
	await page.goto("/contas");
	await page
		.getByTestId("platform-demo")
		.getByRole("button", { name: /Conectar/ })
		.click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Nome da conta").fill(name);
	await dialog.getByLabel(/Tempo simulado/).fill("600");
	await dialog.getByRole("button", { name: "Conectar" }).click();
	await expect(page.getByText(`${name} conectado!`)).toBeVisible();
	await expect(page.getByTestId("my-accounts").getByText(name)).toBeVisible();
}

test("conecta duas contas (rede Demo)", async () => {
	await connectDemo("Loja Demo");
	await connectDemo("Blog Demo");
});

test("publica agora em duas contas escolhidas com um toque", async () => {
	await page.goto("/novo");
	await expect(page.getByTestId("submit-post").first()).toBeDisabled();
	await expect(page.getByText("Envie um vídeo").first()).toBeVisible();
	await uploadSample(page);

	await destination(page, "Loja Demo").click();
	await expect(destination(page, "Loja Demo")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await destination(page, "Blog Demo").click();

	await page.getByTestId("caption").fill("Lançamento do Cast 🚀 #ia2s");
	await page.getByTestId("submit-post").first().click();
	const id = await postIdFromUrl(page);
	const card = page.getByTestId(`post-${id}`);
	await expect(card).toHaveAttribute("data-status", "published", {
		timeout: 30_000,
	});
	await expect(card.getByText("Publicado", { exact: true })).toBeVisible();
	await expect(card.getByText("2/2 publicados")).toBeVisible();
});

test("vídeo enviado é servido com suporte a Range (para as redes baixarem)", async () => {
	const posts = await rpc<{ media: { url: string } | null }[]>(
		page,
		"posts/list",
		{ limit: 1 },
	);
	const url = new URL(posts[0]!.media!.url);
	const res = await page.request.get(url.pathname, {
		headers: { range: "bytes=0-99" },
	});
	expect(res.status()).toBe(206);
	expect(res.headers()["content-range"]).toMatch(/^bytes 0-99\//);
	const forbidden = await page.request.get(
		url.pathname.replace(/\/[^/]+\/([^/]+)$/, "/token-errado/$1"),
	);
	expect(forbidden.status()).toBe(404);
});

test("falha aparece em linguagem simples, com botão para tentar de novo", async () => {
	await page.goto("/novo");
	await uploadSample(page);
	await destination(page, "Loja Demo").click();
	await page.getByTestId("caption").fill("Esse vai dar erro #falha");
	await page.getByTestId("submit-post").first().click();
	const id = await postIdFromUrl(page);
	const card = page.getByTestId(`post-${id}`);
	await expect(card).toHaveAttribute("data-status", "failed", {
		timeout: 30_000,
	});

	const box = card.getByTestId("failure-box");
	await expect(box).toContainText("Falha simulada (rede de teste)");
	// detalhes por toque (funciona no celular), sem disparar nova tentativa
	await card.locator('button[data-status="failed"]').first().click();
	await expect(page.getByText("Detalhes técnicos")).toBeVisible();
	await page.keyboard.press("Escape");

	await box.getByRole("button", { name: "Tentar de novo" }).click();
	await expect(page.getByText("Nova tentativa na fila")).toBeVisible();
	await expect(card).toHaveAttribute("data-status", "failed", {
		timeout: 30_000,
	});
});

test("validação bloqueia legenda acima do limite da rede", async () => {
	await page.goto("/novo");
	await uploadSample(page);
	await destination(page, "Loja Demo").click();
	await page.getByTestId("caption").fill("a".repeat(5001));
	await expect(
		page
			.getByText("Legenda acima de 5000 caracteres")
			.filter({ visible: true }),
	).toBeVisible();
	await expect(page.getByTestId("submit-post").first()).toBeDisabled();
});

let scheduledId = "";

test("agenda para amanhã e remarca arrastando no calendário", async () => {
	await page.goto("/novo");
	await uploadSample(page);
	await destination(page, "Blog Demo").click();
	await page.getByTestId("caption").fill("Post agendado pelo teste");
	await page.getByTestId("when-later").click();
	await page.getByRole("button", { name: "Amanhã 12h" }).click();
	await expect(page.getByTestId("submit-post").first()).toHaveText(
		/Agendar post/,
	);
	await page.getByTestId("submit-post").first().click();
	scheduledId = await postIdFromUrl(page);
	await expect(page.getByTestId(`post-${scheduledId}`)).toHaveAttribute(
		"data-status",
		"scheduled",
	);

	const tomorrow = addDays(startOfDay(new Date()), 1);
	await page.goto("/agenda");
	if (tomorrow.getMonth() !== new Date().getMonth())
		await page.getByRole("button", { name: "Próximo mês" }).click();
	const chipEl = page.getByTestId(`agenda-post-${scheduledId}`);
	await expect(chipEl).toBeVisible();

	let target: Date | null = null;
	for (let i = 1; i <= 6 && !target; i++) {
		const d = addDays(tomorrow, i);
		if (await page.getByTestId(`day-${format(d, "yyyy-MM-dd")}`).count())
			target = d;
	}
	expect(target).not.toBeNull();
	await dragTo(
		page,
		chipEl,
		page.getByTestId(`day-${format(target!, "yyyy-MM-dd")}`),
	);
	await expect(page.getByText("Post remarcado")).toBeVisible();

	const post = await rpc<{ scheduledAt: string }>(page, "posts/get", {
		id: scheduledId,
	});
	const when = new Date(post.scheduledAt);
	expect(format(when, "yyyy-MM-dd")).toBe(format(target!, "yyyy-MM-dd"));
	expect(format(when, "HH:mm")).toBe("12:00");
});

test("edita legenda e horário de um post agendado", async () => {
	await page.goto("/posts?status=scheduled");
	const card = page.getByTestId(`post-${scheduledId}`);
	await card.getByRole("button", { name: "Ações do post" }).click();
	await page.getByRole("menuitem", { name: "Editar texto e horário" }).click();
	await page.getByTestId("edit-caption").fill("Legenda corrigida");
	await page.getByTestId("edit-time").fill("15:30");
	await page.getByTestId("edit-save").click();
	await expect(card.getByText("Legenda corrigida")).toBeVisible();
	const post = await rpc<{ scheduledAt: string; caption: string }>(
		page,
		"posts/get",
		{ id: scheduledId },
	);
	expect(post.caption).toBe("Legenda corrigida");
	expect(format(new Date(post.scheduledAt), "HH:mm")).toBe("15:30");
});

test('"Publicar agora" antecipa um post agendado', async () => {
	await page.goto("/posts");
	const card = page.getByTestId(`post-${scheduledId}`);
	await card.getByRole("button", { name: "Ações do post" }).click();
	await page.getByRole("menuitem", { name: "Publicar agora" }).click();
	await expect(card).toHaveAttribute("data-status", "published", {
		timeout: 30_000,
	});
});

test('"Usar este vídeo de novo" abre o compositor com vídeo e legenda', async () => {
	await page.goto("/posts");
	const card = page.getByTestId(`post-${scheduledId}`);
	await card.getByRole("button", { name: "Ações do post" }).click();
	await page.getByRole("menuitem", { name: "Usar este vídeo de novo" }).click();
	await expect(page).toHaveURL(/\/novo\?video=/);
	await expect(page.getByTestId("upload-done")).toBeVisible();
	await expect(page.getByTestId("caption")).toHaveValue("Legenda corrigida");
	await destination(page, "Loja Demo").click();
	await page.getByTestId("submit-post").first().click();
	const id = await postIdFromUrl(page);
	await expect(page.getByTestId(`post-${id}`)).toHaveAttribute(
		"data-status",
		"published",
		{ timeout: 30_000 },
	);
});

test("painel mostra números e atividade", async () => {
	await page.goto("/painel");
	await expect(
		page
			.getByText("Contas conectadas", { exact: true })
			.filter({ visible: true }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Atividade recente" }),
	).toBeVisible();
	await expect(page.getByText("Lançamento do Cast").first()).toBeVisible();
	await page.getByText("Com falha (7 dias)").filter({ visible: true }).click();
	await expect(page).toHaveURL(/status=failed/);
});

let adminAccountId = "";
let adminPostId = "";

test("admin cria um membro; cada um só vê o que é seu", async () => {
	adminAccountId = (await rpc<{ id: string }[]>(page, "accounts/list"))[0]!.id;
	adminPostId = (
		await rpc<{ id: string }[]>(page, "posts/list", { limit: 1 })
	)[0]!.id;
	await page.goto("/configuracoes");
	await page.getByRole("tab", { name: "Usuários" }).click();
	await page.getByRole("button", { name: "Adicionar" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Nome").fill(MEMBER.name);
	await dialog.getByLabel("E-mail").fill(MEMBER.email);
	await dialog.getByLabel("Senha inicial").fill(MEMBER.password);
	await dialog.getByRole("button", { name: "Criar acesso" }).click();
	await expect(page.getByText(MEMBER.email)).toBeVisible();

	await page.context().clearCookies();
	await login(page, MEMBER);
	await expect(page.getByRole("link", { name: "Configurações" })).toHaveCount(
		0,
	);
	await page.goto("/configuracoes");
	await expect(page).toHaveURL(/\/painel/);

	// não vê nem mexe nas contas e posts de outro usuário
	await page.goto("/contas");
	await expect(page.getByText("Loja Demo")).toHaveCount(0);
	expect(await rpc<unknown[]>(page, "accounts/list")).toHaveLength(0);
	expect(await rpc<unknown[]>(page, "posts/list")).toHaveLength(0);
	expect(
		(await rpcRaw(page, "accounts/remove", { id: adminAccountId })).status(),
	).toBe(404);
	expect((await rpcRaw(page, "posts/get", { id: adminPostId })).status()).toBe(
		404,
	);
	expect(
		(await rpcRaw(page, "posts/cancel", { id: adminPostId })).status(),
	).toBe(404);
	const stats = await rpc<{ accounts: number }>(page, "posts/stats");
	expect(stats.accounts).toBe(0);
	expect((await rpcRaw(page, "team/list")).status()).toBe(403);
	expect(
		(
			await rpcRaw(page, "platforms/saveConfig", {
				platform: "youtube",
				clientId: "x",
				clientSecret: "y",
			})
		).status(),
	).toBe(403);
});

test("membro troca a própria senha", async () => {
	await page.goto("/painel");
	await page.locator("aside").getByRole("button", { name: /BL/ }).click();
	await page.getByRole("menuitem", { name: "Trocar senha" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Senha atual").fill(MEMBER.password);
	await dialog.getByLabel("Nova senha", { exact: true }).fill("senha-nova-789");
	await dialog.getByLabel("Repita a nova senha").fill("senha-nova-789");
	await dialog.getByRole("button", { name: "Salvar nova senha" }).click();
	await expect(page.getByText("Senha trocada")).toBeVisible();
	await page.context().clearCookies();
	await login(page, { ...MEMBER, password: "senha-nova-789" });
});

test("cadastro livre entra no teste grátis; com o acesso encerrado não publica mais", async ({
	browser,
}) => {
	const trial = await browser.newPage();
	await trial.goto("/");
	// botão com cara de link: o Button do base-ui mantém role="button" no <a>
	await trial.locator('header a[href="/login?modo=cadastro"]').click();
	await expect(
		trial.getByRole("heading", { name: "Crie sua conta" }),
	).toBeVisible();
	await trial.getByLabel("Seu nome").fill(TRIAL_USER.name);
	await trial.getByLabel("E-mail").fill(TRIAL_USER.email);
	await trial.getByLabel("Senha", { exact: true }).fill(TRIAL_USER.password);
	await trial.getByRole("checkbox").click();
	await trial.getByRole("button", { name: "Criar conta e entrar" }).click();
	await expect(trial).toHaveURL(/\/painel/);
	await expect(trial.getByTestId("trial-banner")).toContainText(
		"dias restantes",
	);

	// o admin encerra o acesso
	await page.context().clearCookies();
	await login(page, ADMIN);
	const users = await rpc<{ id: string; email: string }[]>(page, "team/list");
	const me = users.find((u) => u.email === TRIAL_USER.email)!;
	await rpc(page, "team/setAccess", {
		id: me.id,
		until: new Date(Date.now() - 1000).toISOString(),
	});

	await trial.reload();
	await expect(trial.getByTestId("trial-banner")).toContainText(
		"teste grátis terminou",
	);
	const create = await rpcRaw(trial, "posts/create", {
		mediaId: "x",
		targets: [{ accountId: "y" }],
	});
	expect(create.status()).toBe(403);
	const upload = await trial.request.post("/api/media", {
		data: Buffer.from("x"),
		headers: { "content-type": "video/mp4" },
	});
	expect(upload.status()).toBe(403);

	// liberado de novo, a faixa some
	await rpc(page, "team/setAccess", { id: me.id, until: null });
	await trial.reload();
	await expect(trial.getByTestId("trial-banner")).toHaveCount(0);
	await trial.close();
});

test("usuário exclui a própria conta e os dados somem", async ({ browser }) => {
	const gone = await browser.newPage();
	await gone.goto("/login?modo=cadastro");
	await gone.getByLabel("Seu nome").fill("Conta Temporária");
	await gone.getByLabel("E-mail").fill("temporaria@x.com");
	await gone.getByLabel("Senha", { exact: true }).fill("senha-temporaria-1");
	await gone.getByRole("checkbox").click();
	await gone.getByRole("button", { name: "Criar conta e entrar" }).click();
	await expect(gone).toHaveURL(/\/painel/);

	await gone.locator("aside").getByRole("button", { name: /CT/ }).click();
	await gone.getByRole("menuitem", { name: "Excluir minha conta" }).click();
	const dialog = gone.getByRole("dialog");
	await dialog.getByLabel("Confirme sua senha").fill("senha-errada-123");
	await dialog.getByRole("button", { name: "Excluir para sempre" }).click();
	await expect(dialog.getByText("Senha incorreta")).toBeVisible();
	await dialog.getByLabel("Confirme sua senha").fill("senha-temporaria-1");
	await dialog.getByRole("button", { name: "Excluir para sempre" }).click();
	await expect(gone).toHaveURL("/");
	await gone.close();

	const users = await rpc<{ email: string }[]>(page, "team/list");
	expect(users.some((u) => u.email === "temporaria@x.com")).toBe(false);
});
