import path from "node:path";

import { type Page, test } from "@playwright/test";

import { ADMIN, destination, login, uploadSample } from "./helpers";

// Revisão visual sob demanda: SCREENSHOTS=1 (roda depois do fluxo completo popular a base).
test.skip(!process.env.SCREENSHOTS, "somente com SCREENSHOTS=1");

const out = path.resolve(import.meta.dirname, "..", ".data", "screens");
const VIEWPORTS = [
	{ name: "320", width: 320, height: 640 },
	{ name: "390", width: 390, height: 844 },
	{ name: "768", width: 768, height: 1024 },
	{ name: "1024", width: 1024, height: 768 },
	{ name: "1440", width: 1440, height: 900 },
];
const ROUTES = ["painel", "novo", "agenda", "posts", "contas", "configuracoes"];

async function shot(page: Page, name: string, fullPage = true) {
	await page.waitForTimeout(700);
	await page.screenshot({ path: path.join(out, `${name}.png`), fullPage });
}

test("telas em todos os tamanhos", async ({ page }) => {
	test.setTimeout(180_000);
	await page.goto("/login");
	for (const vp of VIEWPORTS) {
		await page.setViewportSize({ width: vp.width, height: vp.height });
		await shot(page, `${vp.name}-login`, false);
	}
	await login(page, ADMIN);
	for (const vp of VIEWPORTS) {
		await page.setViewportSize({ width: vp.width, height: vp.height });
		for (const route of ROUTES) {
			await page.goto(`/${route}`);
			await shot(page, `${vp.name}-${route}`);
		}
	}
});

test("estados do compositor e diálogos", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await login(page, ADMIN);
	await page.goto("/novo");
	await uploadSample(page);
	await destination(page, "Loja Demo").click();
	await destination(page, "Blog Demo").click();
	await page
		.getByTestId("caption")
		.fill(
			"Novidade da semana! Confira o vídeo completo no link da bio. #ia2s #tecnologia",
		);
	await page.getByTestId("when-later").click();
	await shot(page, "estado-compositor-preenchido");

	await page.emulateMedia({ colorScheme: "light" });
	await page.evaluate(() => localStorage.setItem("theme", "light"));
	await page.reload();
	await shot(page, "estado-compositor-vazio-claro");
	await page.evaluate(() => localStorage.setItem("theme", "dark"));

	await page.goto("/contas");
	await page
		.getByTestId("platform-bluesky")
		.getByRole("button", { name: /Conectar/ })
		.click();
	await shot(page, "estado-dialogo-bluesky", false);
	await page.keyboard.press("Escape");

	await page.goto("/configuracoes#youtube");
	await shot(page, "estado-config-youtube");

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/novo");
	await uploadSample(page);
	await destination(page, "Loja Demo").click();
	await page.getByTestId("caption").fill("Teste no celular");
	await shot(page, "estado-compositor-mobile");
});
