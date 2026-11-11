import { workerStatus } from "@autopost/social";

import { protectedProcedure } from "../index";

export const systemRouter = {
	/** Se o worker parou, a interface avisa que os posts não vão sair. */
	status: protectedProcedure.handler(async ({ context }) => {
		const worker = await workerStatus(context.db);
		return { worker };
	}),
};
