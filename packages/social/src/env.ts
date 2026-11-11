import { existsSync } from "node:fs";
import path from "node:path";

/** Variáveis lidas direto do ambiente: o mesmo pacote roda no web (Next) e no worker (Bun). */
const env = process.env;

export function appUrl(): string {
	return (
		env.APP_URL ||
		env.BETTER_AUTH_URL ||
		"http://localhost:3001"
	).replace(/\/$/, "");
}

/** Raiz do monorepo (dev): web e worker rodam com cwd diferentes e precisam da mesma pasta. */
function repoRoot(): string {
	let dir = process.cwd();
	while (!existsSync(path.join(/*turbopackIgnore: true*/ dir, "turbo.json"))) {
		const parent = path.dirname(dir);
		if (parent === dir) return process.cwd();
		dir = parent;
	}
	return dir;
}

let cachedUploadDir: string | undefined;
export function uploadDir(): string {
	cachedUploadDir ??= path.resolve(
		/*turbopackIgnore: true*/ env.UPLOAD_DIR ||
			path.join(/*turbopackIgnore: true*/ repoRoot(), ".data", "uploads"),
	);
	return cachedUploadDir;
}

export function encryptionSecret(): string {
	const secret = env.ENCRYPTION_KEY || env.BETTER_AUTH_SECRET;
	if (!secret)
		throw new Error(
			"ENCRYPTION_KEY ou BETTER_AUTH_SECRET precisa estar definido",
		);
	return secret;
}

/** Plataformas que baixam o vídeo por URL só funcionam se o app estiver acessível publicamente. */
export function isPublicAppUrl(): boolean {
	const url = appUrl();
	return (
		url.startsWith("https://") && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url)
	);
}
