import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { ADMIN, login } from "./helpers";

// Roda por último (base já populada). Falha só em problemas sérios/críticos (WCAG A/AA).
const ROUTES = [
	"/painel",
	"/novo",
	"/agenda",
	"/posts",
	"/contas",
	"/configuracoes",
];

async function scan(page: Page, where: string) {
	const result = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
		.analyze();
	const serious = result.violations.filter(
		(v) => v.impact === "serious" || v.impact === "critical",
	);
	const report = serious.map(
		(v) =>
			`${v.id}: ${v.help} → ${v.nodes
				.map((n) => n.target.join(" "))
				.slice(0, 3)
				.join(" | ")}`,
	);
	expect.soft(report, where).toEqual([]);
}

test("acessibilidade nos temas escuro e claro", async ({ page }) => {
	test.setTimeout(180_000);
	for (const theme of ["dark", "light"] as const) {
		await page.emulateMedia({ colorScheme: theme });
		await page.goto("/login");
		await page.evaluate((t) => localStorage.setItem("theme", t), theme);
		for (const route of ["/login", "/login?modo=cadastro", "/", "/termos"]) {
			await page.goto(route);
			await page.waitForLoadState("networkidle");
			await scan(page, `${route} (${theme})`);
		}
	}
	await login(page, ADMIN);
	for (const theme of ["dark", "light"] as const) {
		await page.evaluate((t) => localStorage.setItem("theme", t), theme);
		for (const route of ROUTES) {
			await page.goto(route);
			await page.waitForLoadState("networkidle");
			await scan(page, `${route} (${theme})`);
		}
	}
});
