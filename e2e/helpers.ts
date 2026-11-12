import { expect, type Locator, type Page } from "@playwright/test";

import { SAMPLE_VIDEO } from "./global-setup";

export const ADMIN = {
	name: "Ana Souza",
	email: "ana@ia2s.com.br",
	password: "senha-forte-123",
};
export const MEMBER = {
	name: "Bruno Lima",
	email: "bruno@ia2s.com.br",
	password: "outra-senha-456",
};

export const TRIAL_USER = {
	name: "Carla Teste",
	email: "carla@cliente.com",
	password: "senha-de-teste-321",
};

export async function login(page: Page, user = ADMIN) {
	// Todos os logins saem do mesmo IP: se bater no limite de tentativas do login, espera a janela.
	const limited = page.getByText(/Muitas tentativas/);
	for (let attempt = 0; ; attempt++) {
		await page.goto("/login");
		await page.getByLabel("E-mail").fill(user.email);
		await page.getByLabel("Senha", { exact: true }).fill(user.password);
		await page.getByRole("button", { name: "Entrar" }).click();
		const hitLimit = await Promise.race([
			page.waitForURL(/\/painel/, { timeout: 15_000 }).then(() => false),
			limited.waitFor({ timeout: 15_000 }).then(() => true),
		]).catch(() => false);
		if (!hitLimit || attempt >= 2) break;
		await page.waitForTimeout(11_000);
	}
	await expect(page).toHaveURL(/\/painel/);
}

/** Arrasto com eventos reais de mouse (dnd-kit usa PointerSensor com distância mínima). */
export async function dragTo(page: Page, source: Locator, target: Locator) {
	const s = await source.boundingBox();
	const t = await target.boundingBox();
	if (!s || !t) throw new Error("elemento sem caixa para arrastar");
	await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
	await page.mouse.down();
	await page.mouse.move(s.x + s.width / 2 + 12, s.y + s.height / 2 + 4, {
		steps: 4,
	});
	await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 16 });
	await page.mouse.move(t.x + t.width / 2 + 2, t.y + t.height / 2 + 2, {
		steps: 2,
	});
	await page.mouse.up();
}

export async function uploadSample(page: Page) {
	await page.getByTestId("video-input").setInputFiles(SAMPLE_VIDEO);
	await expect(page.getByTestId("upload-done")).toBeVisible({
		timeout: 30_000,
	});
}

/** Cartão de conta no passo "Onde publicar" do compositor. */
export function destination(page: Page, name: string) {
	return page
		.getByTestId("destinations")
		.getByRole("button", { name: new RegExp(name) });
}

export async function postIdFromUrl(page: Page) {
	await expect(page).toHaveURL(/destaque=/);
	return new URL(page.url()).searchParams.get("destaque") as string;
}

/** Chamada oRPC com o header anti-CSRF que o cliente oficial manda. */
export async function rpcRaw(
	page: Page,
	path: string,
	input: unknown = {},
	csrf = true,
) {
	return page.request.post(`/api/rpc/${path}`, {
		data: { json: input },
		headers: csrf ? { "x-csrf-token": "orpc" } : {},
	});
}

export async function rpc<T = any>(
	page: Page,
	path: string,
	input: unknown = {},
): Promise<T> {
	const res = await rpcRaw(page, path, input);
	expect(res.ok(), `rpc ${path} → ${res.status()}`).toBeTruthy();
	return ((await res.json()) as { json: T }).json;
}
