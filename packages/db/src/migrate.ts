/** Aplica as migrations pendentes (usado no deploy, antes de subir web/worker). */
import path from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDb } from "./index";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definido");

const db = createDb({ DATABASE_URL: url });
await migrate(db, {
	migrationsFolder: path.join(import.meta.dirname, "migrations"),
});
console.log("[migrate] banco atualizado");
await db.$client.end();
