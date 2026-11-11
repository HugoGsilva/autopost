/**
 * Worker de publicação: a cada ciclo reserva os destinos vencidos e publica.
 * Pode rodar mais de uma instância (reserva usa FOR UPDATE SKIP LOCKED).
 * Também bate o "ponto" (a interface avisa se ele parar) e limpa vídeos antigos.
 */
import { hostname } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDb } from "@autopost/db";
import { cleanupMedia, heartbeat, tick } from "@autopost/social";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 5000);
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 4);
const RETENTION_DAYS = Number(process.env.MEDIA_RETENTION_DAYS ?? 30);
const WORKER_ID = `${hostname()}:${process.pid}`;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definido");
const db = createDb({ DATABASE_URL: url });

const log = (msg: string) => console.log(`${new Date().toISOString()} ${msg}`);

// No compose as migrations rodam num serviço à parte. No Dokploy, o worker aplica antes de publicar.
if (process.env.MIGRATE_ON_START === "true") {
	const migrationsFolder = path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		"../../../packages/db/src/migrations",
	);
	await migrate(db, { migrationsFolder });
	log("[worker] banco atualizado");
}
const safely = (what: string, fn: () => Promise<unknown>) => () =>
	fn().catch((err) =>
		log(`[worker] erro em ${what}: ${(err as Error).message}`),
	);

let running = true;
let current: Promise<unknown> = Promise.resolve();

// Batimento independente do ciclo: uploads longos não fazem o worker parecer parado.
const beat = safely("heartbeat", () => heartbeat(db, WORKER_ID));
const cleanup = safely("limpeza", async () => {
	const removed = await cleanupMedia(db, { retentionDays: RETENTION_DAYS });
	if (removed) log(`[worker] ${removed} vídeo(s) antigo(s) removido(s)`);
});
const timers = [setInterval(beat, 20_000), setInterval(cleanup, 60 * 60_000)];

async function loop() {
	log(`[worker] iniciado (ciclo ${POLL_MS}ms, ${CONCURRENCY} em paralelo)`);
	await beat();
	await cleanup();
	while (running) {
		current = tick(db, log, CONCURRENCY).catch((err) =>
			log(`[worker] erro no ciclo: ${(err as Error).message}`),
		);
		const processed = await current;
		// Se havia trabalho, emenda o próximo ciclo sem esperar.
		if (!processed) await Bun.sleep(POLL_MS);
	}
}

async function shutdown() {
	log("[worker] encerrando, aguardando publicações em andamento...");
	running = false;
	for (const t of timers) clearInterval(t);
	await current;
	await db.$client.end();
	process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await loop();
