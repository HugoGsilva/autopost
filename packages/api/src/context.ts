import type { Session } from "@autopost/auth";
import type { Database } from "@autopost/db";

export type Context = {
	session: Session | null;
	db: Database;
};
