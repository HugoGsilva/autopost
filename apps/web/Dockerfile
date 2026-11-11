FROM node:24-slim AS builder
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install

# Compose monta o .env como secret. Sem esse secret (Dokploy), o build usa os ARGs.
ARG BETTER_AUTH_SECRET
ARG BETTER_AUTH_URL
ARG DATABASE_URL
ARG APP_URL
ENV NODE_ENV=production
RUN --mount=type=secret,id=web_env,target=/run/secrets/web_env,required=false \
	sh apps/web/docker-build-env.sh
# standalone output excludes public/; ensure it exists so the runner copy never fails
RUN mkdir -p apps/web/public

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
# auto-load needs the Varlock CLI and its installed dependencies.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/.env.schema ./apps/web/.env.schema

ENV HOSTNAME=0.0.0.0
ENV UPLOAD_DIR=/data/uploads
# O build grava o standalone como root. O processo sobe como node e precisa ler esses arquivos.
RUN chmod -R a+rX /app && mkdir -p /data/uploads && chown node:node /data/uploads
ENV PORT=3001
EXPOSE 3001

WORKDIR /app/apps/web
# Sem root em produção (uid 1000, o mesmo do worker, para compartilhar o volume de vídeos)
USER node
CMD ["node", "--import", "varlock/auto-load", "server.js"]
