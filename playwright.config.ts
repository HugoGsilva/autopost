import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 60_000,
	expect: { timeout: 15_000 },
	reporter: [["list"], ["html", { open: "never" }]],
	globalSetup: "./e2e/global-setup.ts",
	use: {
		baseURL: `http://localhost:${PORT}`,
		locale: "pt-BR",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "desktop",
			use: { ...devices["Desktop Chrome"] },
			testIgnore: /mobile\.spec\.ts/,
		},
		{
			name: "mobile",
			use: { ...devices["Pixel 7"] },
			testMatch: /mobile\.spec\.ts/,
			dependencies: ["desktop"],
		},
	],
	webServer: {
		command: "bun scripts/e2e-stack.ts",
		url: `http://localhost:${PORT}/login`,
		timeout: 6 * 60_000,
		reuseExistingServer: !process.env.CI,
		stdout: "pipe",
	},
});
