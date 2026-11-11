import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { accountsRouter, platformsRouter } from "./platforms";
import { postsRouter } from "./posts";
import { systemRouter } from "./system";
import { teamRouter } from "./team";

export const appRouter = {
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	platforms: platformsRouter,
	accounts: accountsRouter,
	posts: postsRouter,
	team: teamRouter,
	system: systemRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
