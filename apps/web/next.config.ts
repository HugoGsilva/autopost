import { varlockNextConfigPlugin } from "@varlock/nextjs-integration/plugin";

const withVarlock = varlockNextConfigPlugin();

import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const isHttps = (
	process.env.APP_URL ||
	process.env.BETTER_AUTH_URL ||
	""
).startsWith("https://");

// Next injeta scripts inline (hidratação): 'unsafe-inline' é necessário sem nonce.
const csp = [
	"default-src 'self'",
	`script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https:",
	"media-src 'self' blob:",
	"font-src 'self' data:",
	"connect-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
	{ key: "Content-Security-Policy", value: csp },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=()",
	},
	...(isHttps
		? [
				{
					key: "Strict-Transport-Security",
					value: "max-age=31536000; includeSubDomains",
				},
			]
		: []),
];

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	output: "standalone",
	poweredByHeader: false,
	// Testes E2E usam uma pasta de build separada para não colidir com o `next dev`.
	distDir: process.env.NEXT_DIST_DIR || ".next",
	async headers() {
		return [{ source: "/:path*", headers: securityHeaders }];
	},
};

export default withVarlock(nextConfig);
