import { createAuth } from "@autopost/auth";
import { createDb } from "@autopost/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
