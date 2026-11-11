#!/bin/sh
# Gera o .env do build. O compose manda o arquivo via secret; o Dokploy manda ARGs.
set -eu
if [ -s /run/secrets/web_env ]; then
	cp /run/secrets/web_env /app/apps/web/.env.local
else
	test -n "$BETTER_AUTH_SECRET"
	test -n "$BETTER_AUTH_URL"
	test -n "$DATABASE_URL"
	umask 077
	app_url="${APP_URL:-$BETTER_AUTH_URL}"
	printf 'BETTER_AUTH_SECRET=%s\nBETTER_AUTH_URL=%s\nDATABASE_URL=%s\nAPP_URL=%s\nCORS_ORIGIN=%s\nNODE_ENV=production\n' \
		"$BETTER_AUTH_SECRET" "$BETTER_AUTH_URL" "$DATABASE_URL" "$app_url" "$app_url" \
		> /app/apps/web/.env.local
	umask 022
fi
cd /app/apps/web
bun run build
rm -f .next/standalone/.env* .next/standalone/apps/web/.env* /app/apps/web/.env.local
