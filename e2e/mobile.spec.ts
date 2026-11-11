import { expect, type Page, test } from "@playwright/test";

import { ADMIN, destination, login, uploadSample } from "./helpers";

// Roda depois do fluxo completo (admin, contas e posts já existem).
// Uma sessão só para o arquivo: logins seguidos esbarram no rate limit (de propósito).
test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }, info) => {
	page = await browser.newPage({ ...info.project.use });
	await login(page, ADMIN);
});

test.afterAll(async () => {
	await page.close();
});

const visible = (text: string | RegExp) =>
	page.getByText(text).filter({ visible: true });

test("celular: barra inferior, botão de publicar sempre visível e sem rolagem lateral", async () => {
	const bottomNav = page.locator("nav.fixed");
	await expect(bottomNav).toBeVisible();
	await bottomNav.getByRole("link", { name: "Novo" }).click();
	await expect(page).toHaveURL(/\/novo/);
	await expect(visible("Arraste o vídeo aqui")).toBeVisible();

	// botão fixo na parte de baixo, já visível sem rolar, com o motivo do bloqueio
	const submit = page.getByTestId("submit-post").filter({ visible: true });
	await expect(submit).toBeInViewport();
	await expect(visible("Envie um vídeo")).toBeVisible();

	await uploadSample(page);
	await destination(page, "Loja Demo").click();
	await expect(submit).toBeEnabled();
	await expect(
		page
			.getByText("Pronto para publicar", { exact: true })
			.filter({ visible: true }),
	).toBeVisible();

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth,
	);
	expect(overflow).toBeLessThanOrEqual(1);
});

test("celular: agenda em lista por dia e posts sem depender de mouse", async () => {
	await page.goto("/painel");
	await page.locator("nav.fixed").getByRole("link", { name: "Agenda" }).click();
	await expect(visible("Seu calendário de conteúdo")).toBeVisible();
	await expect(page.getByTestId("agenda-mobile")).toBeVisible();

	await page.goto("/posts?status=failed");
	await expect(
		page.getByTestId("failure-box").filter({ visible: true }).first(),
	).toBeVisible();
	for (const path of [
		"/painel",
		"/posts",
		"/contas",
		"/agenda",
		"/configuracoes",
	]) {
		await page.goto(path);
		await page.waitForLoadState("networkidle");
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - window.innerWidth,
		);
		expect(overflow, `rolagem lateral em ${path}`).toBeLessThanOrEqual(1);
	}
});
