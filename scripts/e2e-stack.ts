/**
 * Sobe uma stack isolada para os testes E2E, sem Docker:
 * Postgres embutido (porta 5433, dados descartáveis) + build de produção do web (3100) + worker.
 * Usado pelo Playwright (webServer). E2E_SKIP_BUILD=1 reaproveita o último build.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const root = path.resolve(import.meta.dirname, "..");
const base = path.join(root, ".data", "e2e");
const PG_PORT = 5433;
const WEB_PORT = 3100;

// Um Postgres recém-encerrado pode segurar arquivos por alguns segundos no Windows.
for (let i = 0; ; i++) {
	try {
		rmSync(base, { recursive: true, force: true });
		break;
	} catch (err) {
		if (i >= 15) throw err;
		await new Promise((r) => setTimeout(r, 1000));
	}
}

const pg = new EmbeddedPostgres({
	databaseDir: path.join(base, "pg"),
	user: "postgres",
	password: "password",
	port: PG_PORT,
	persistent: false,
	// No Linux (CI) o bun não roda o script que cria os links das libs do Postgres.
	autoRehydrateSymlinks: true,
	initdbFlags: ["--encoding=UTF8", "--locale=C"],
	onLog: () => {},
});
await pg.initialise();
await pg.start();
await pg.createDatabase("autopost");

const env = {
	...process.env,
	DATABASE_URL: `postgresql://postgres:password@localhost:${PG_PORT}/autopost`,
	BETTER_AUTH_URL: `http://localhost:${WEB_PORT}`,
	CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
	APP_URL: `http://localhost:${WEB_PORT}`,
	UPLOAD_DIR: path.join(base, "uploads"),
	NEXT_DIST_DIR: ".next-e2e",
	WORKER_POLL_MS: "1000",
	DEMO_ENABLED: "true",
	SIGNUP_RATE_LIMIT: "100",
	NODE_ENV: "production",
};

const children: ChildProcess[] = [];
function run(
	cmd: string,
	args: string[],
	cwd: string,
	opts: { wait?: boolean; tag: string },
) {
	const child = spawn(cmd, args, {
		cwd: path.join(root, cwd),
		env,
		shell: process.platform === "win32",
	});
	child.stdout?.on("data", (d) => process.stdout.write(`[${opts.tag}] ${d}`));
	child.stderr?.on("data", (d) => process.stderr.write(`[${opts.tag}] ${d}`));
	if (!opts.wait) {
		children.push(child);
		return Promise.resolve(0);
	}
	return new Promise<number>((resolve, reject) =>
		child.on("exit", (code) =>
			code === 0
				? resolve(0)
				: reject(new Error(`${opts.tag} saiu com código ${code}`)),
		),
	);
}

function killTree(child: ChildProcess) {
	if (!child.pid) return;
	// No Windows o processo vem via shell: mata a árvore inteira.
	if (process.platform === "win32")
		spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
	else child.kill();
}

async function shutdown() {
	for (const c of children) killTree(c);
	await pg.stop().catch(() => {});
	process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await run("bun", ["x", "drizzle-kit", "push", "--force"], "packages/db", {
	wait: true,
	tag: "db",
});
if (!process.env.E2E_SKIP_BUILD)
	await run("bun", ["x", "next", "build"], "apps/web", {
		wait: true,
		tag: "build",
	});
await run("bun", ["x", "next", "start", "-p", String(WEB_PORT)], "apps/web", {
	tag: "web",
});
await run(
	"bun",
	["x", "varlock", "run", "--path", "../web/", "--", "bun", "src/index.ts"],
	"apps/worker",
	{ tag: "worker" },
);
console.log(`[e2e] stack pronta em http://localhost:${WEB_PORT}`);
await new Promise(() => {});
