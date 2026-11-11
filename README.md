# IA2S Cast (autopost)

Envie um vídeo uma vez e publique em várias redes, na hora ou agendado. É uma ferramenta interna da IA2S, com a identidade visual da marca (preto quente + ouro, Fraunces + Manrope), feita para quem não tem conhecimento técnico.

**Redes:** Instagram (Reels), Facebook (Páginas), YouTube (vídeos/Shorts), TikTok, LinkedIn, X, Threads, Pinterest, Bluesky, Telegram, Discord + **Demo** (rede simulada para treinar a equipe).

## Stack

[Better-T-Stack](https://better-t-stack.dev): Next.js 16 (App Router) · oRPC · Drizzle + PostgreSQL · Better Auth · Tailwind v4 + shadcn (Base UI) · Turborepo · Biome · Bun.

```
apps/web        Next.js: interface, API (oRPC), upload de vídeo, rotas OAuth
apps/worker     Worker (Bun): publica os posts vencidos, renova tokens, limpa vídeos antigos
packages/social Integrações das redes, criptografia, fila, tradução de erros, anti-SSRF
packages/api    Rotas oRPC (posts, contas, plataformas, equipe, status do sistema)
packages/db     Schema Drizzle + migrations
packages/auth   Better Auth (1º cadastro vira admin; depois só o admin cria acessos)
packages/ui     Componentes shadcn + tema IA2S
e2e/            Playwright: fluxo completo, celular, segurança, acessibilidade, screenshots
```

## Como funciona

1. **O admin configura cada rede uma vez** em Configurações → Redes sociais. Há um passo a passo, a URL de retorno para copiar e os campos de Client ID/Secret. Os segredos ficam criptografados (AES-256-GCM).
2. **A equipe conecta as contas** em Contas, com o botão "Entrar com Instagram" etc. (OAuth). Os requisitos de cada rede aparecem antes do login. Bluesky, Telegram e Discord conectam direto, sem app de desenvolvedor.
3. **Novo post**: arraste o vídeo → toque nas contas de destino → legenda (com ajustes por rede, se quiser) → agora ou agendado. O sistema confere formato, tamanho, duração e legenda de cada rede antes de publicar e avisa quando a proporção do vídeo não é a ideal. No celular, o botão de publicar fica fixo no rodapé.
4. **O worker** publica no horário, renova os tokens e tenta de novo os erros temporários (1, 5 e 15 min). Erros técnicos viram mensagem simples, com o botão certo: "Reconectar conta", "Enviar outro vídeo" ou "Tentar de novo".
5. **Agenda**: no computador, um calendário em que você arrasta o post para outro dia; no celular, uma lista por dia.
6. **Publicações**: status em tempo real, "Editar texto e horário", "Usar este vídeo de novo", cancelar um destino e ver detalhes técnicos.
7. Se o worker parar, aparece uma faixa vermelha em todas as telas.

## Desenvolvimento (sem Docker)

O Postgres local roda via `embedded-postgres` (binários reais, sem Docker).

```bash
bun install
bun run db:start      # terminal 1: Postgres em localhost:5432 (dados em .data/pg)
bun run db:push       # aplica o schema
bun run dev           # terminal 2: web (http://localhost:3001) + worker
```

No primeiro acesso, a tela de login cria a conta de administrador. Para testar sem as credenciais das redes, conecte uma conta **Demo**. Escreva `#falha` na legenda para simular um erro.

## Testes

```bash
bun run test                  # unitários: integrações com fetch simulado, cripto, anti-SSRF, erros, upload
bun run test:e2e              # Playwright: stack isolada (Postgres :5433, build de produção :3100, worker)
bash scripts/e2e-rerun.sh     # roda de novo com banco limpo (E2E_SKIP_BUILD= força rebuild)
SCREENSHOTS=1 bunx playwright test screens   # screenshots em 320/390/768/1024/1440 em .data/screens
```

A suíte E2E cobre:

- primeiro acesso e cadastro fechado;
- cabeçalhos de segurança, CSRF e SSRF;
- OAuth (URL e state);
- contas, publicação, falha e nova tentativa, validações;
- agendar, remarcar arrastando, editar, publicar agora e reaproveitar o vídeo;
- permissões de membro e troca de senha;
- celular (botão fixo, agenda em lista, sem rolagem lateral);
- acessibilidade WCAG AA (axe) nos temas claro e escuro.

## Deploy na VPS (Docker)

```bash
cp .env.example .env        # APP_URL (https), BETTER_AUTH_SECRET, POSTGRES_PASSWORD
docker compose up -d --build
```

O compose sobe:

- `postgres`;
- `migrate`, que aplica as migrations e sai;
- `web`, ouvindo só em `127.0.0.1:3001`;
- `worker`.

Os vídeos ficam no volume `uploads`, compartilhado entre web e worker. Os containers rodam sem root. Na frente, coloque um proxy reverso com HTTPS. Exemplo com Caddy:

```
cast.ia2s.com.br {
	request_body {
		max_size 4GB
	}
	reverse_proxy 127.0.0.1:3001
}
```

No Nginx, use `client_max_body_size 4g;` e `proxy_request_buffering off;`.

### Variáveis opcionais (no `.env`)

| Variável                | Para quê                                                                   |
| ----------------------- | -------------------------------------------------------------------------- |
| `SETUP_ADMIN_EMAIL`     | Só este e-mail pode criar o admin no primeiro acesso (recomendado).        |
| `ENCRYPTION_KEY`        | Chave própria para cifrar os tokens das redes. Não troque depois de usar.  |
| `TRUSTED_PROXIES`       | IP/CIDR do proxy, para o limite de tentativas de login enxergar o IP real. |
| `WEB_BIND` / `WEB_PORT` | Endereço e porta no host (padrão `127.0.0.1:3001`).                        |
| `UPLOAD_MAX_MB`         | Tamanho máximo do vídeo (padrão 4096).                                     |
| `MEDIA_RETENTION_DAYS`  | Dias que os vídeos de posts encerrados ficam guardados (padrão 30).        |
| `DEMO_ENABLED`          | `true` mostra a rede Demo em produção.                                     |

Mudou o schema? Rode `bun run db:generate` e versione a migration gerada em `packages/db/src/migrations`.

## Segurança

- Sessões via Better Auth com limite de tentativas no login. Cadastro aberto só para o primeiro usuário, sem revelar e-mails existentes.
- API oRPC com proteção CSRF por header. A referência OpenAPI fica desativada em produção.
- Membros postam e conectam contas. Remover ou alterar uma conta exige ser admin ou quem a conectou. Configurar redes e gerenciar a equipe é só para admin.
- Tokens e segredos cifrados no banco, e nunca devolvidos à interface.
- Upload: lista de tipos permitidos, conferência da assinatura do arquivo, limite de tamanho, nome higienizado e gravação em streaming.
- URL do vídeo protegida por token aleatório. Vídeos órfãos são apagados após 24h e os de posts encerrados após `MEDIA_RETENTION_DAYS`.
- Anti-SSRF no servidor do Bluesky informado pelo usuário: só https e só IPs públicos.
- Cabeçalhos: CSP, `frame-ancestors 'none'`, nosniff, Referrer-Policy, HSTS (em https).

## Limitações das plataformas

| Rede                           | Observação                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Todas OAuth                    | Exigem `APP_URL` pública em HTTPS (URL de retorno).                                                                      |
| Instagram / Threads            | Baixam o vídeo pela URL pública do Cast (só funcionam com o sistema publicado). Formatos: MP4/MOV.                       |
| TikTok                         | Sem auditoria do app, os posts saem como **"Só eu"** e a conta precisa estar privada. O Cast avisa no post. Máx. 10 min. |
| Facebook / Instagram / Threads | Em modo desenvolvimento, só contas com papel no app conectam. Para terceiros, é preciso App Review.                      |
| YouTube                        | App em "Teste": a conexão expira em 7 dias. Cota de ~100 uploads/dia.                                                    |
| LinkedIn                       | Só MP4, até 500MB. Token de 60 dias (reconectar). A versão da API expira em ~1 ano (`linkedin.ts`).                      |
| X                              | API paga por uso.                                                                                                        |
| Pinterest                      | "Trial access" cria Pins visíveis só para você.                                                                          |
| Discord / Telegram             | Limite de 20MB (webhook) e 50MB (bot).                                                                                   |
