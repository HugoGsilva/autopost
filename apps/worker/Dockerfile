# Worker de publicação (Bun roda o TypeScript direto). Também usado para rodar as migrations.
FROM oven/bun:1.3-slim
WORKDIR /app
ENV NODE_ENV=production

COPY . .
# Só dependências de produção; scripts (codegen do varlock) não são necessários aqui.
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --production --ignore-scripts

ENV UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads && chown bun:bun /data/uploads
# Sem root em produção (uid 1000, o mesmo do web)
USER bun
CMD ["bun", "apps/worker/src/index.ts"]
