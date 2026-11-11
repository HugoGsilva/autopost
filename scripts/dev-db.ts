/**
 * Postgres local SEM Docker (binários reais via embedded-postgres).
 * Uso: bun run db:local  →  postgresql://postgres:password@localhost:5432/autopost
 */
import { existsSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const port = Number(process.env.PG_PORT ?? 5432);
const dataDir = path.resolve(
	import.meta.dirname,
	"..",
	process.env.PG_DATA_DIR ?? ".data/pg",
);
const database = process.env.PG_DATABASE ?? "autopost";

const pg = new EmbeddedPostgres({
	databaseDir: dataDir,
	user: "postgres",
	password: "password",
	port,
	persistent: true,
	initdbFlags: ["--encoding=UTF8", "--locale=C"],
	onLog: () => {},
});

const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
if (fresh) await pg.initialise();
await pg.start();
await pg.createDatabase(database).catch(() => {});

console.log(
	`[db] Postgres pronto em postgresql://postgres:password@localhost:${port}/${database}`,
);

const stop = async () => {
	await pg.stop();
	process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await new Promise(() => {});
