# Envio do IA2S Cast para revisão do TikTok

Checklist e textos prontos para o formulário do [TikTok for Developers](https://developers.tiktok.com/apps/).
O app passa por duas etapas: **revisão do app** (sair do sandbox) e depois **auditoria do Direct Post** (liberar posts públicos).

## Antes de enviar

- [ ] `apps/web/src/lib/site.ts`: preencher razão social, CNPJ, endereço e (opcional) WhatsApp.
- [ ] Deploy no domínio final, com `/`, `/termos`, `/privacidade` e `/contato` abrindo sem login.
- [ ] Domínio verificado no console (arquivo `tiktok…txt` em `apps/web/public/`).
- [ ] Sandbox criado, com Login Kit + Content Posting API (Direct Post ligado) e a conta de teste como *target user*.
- [ ] Redirect URI: `https://<domínio>/api/connect/tiktok/callback`.
- [ ] Client Key/Secret do sandbox salvos em Configurações → Redes sociais → TikTok.
- [ ] Usuário de revisão criado em Configurações → Usuários, com acesso **sem prazo**.

## Dados do app

| Campo | Valor |
|---|---|
| Nome | IA2S Cast (sem a palavra "TikTok") |
| Categoria | Social / Productivity |
| Ícone | 1024×1024, logo da IA2S |
| Website | `https://<domínio>/` |
| Terms of Service | `https://<domínio>/termos` |
| Privacy Policy | `https://<domínio>/privacidade` |

**Descrição (EN):**
> IA2S Cast is a web app for creators and small businesses to publish the same video to several social networks at once. Users sign up, connect their own TikTok, Instagram, YouTube and other accounts through each network's official login, upload a video once, adjust caption and per-network options, and publish immediately or schedule it. Nothing is posted without the user's explicit action.

## Justificativa dos escopos (EN)

- **user.info.basic** — After the user connects TikTok, we show the connected account (display name and avatar) in the Accounts page and in the composer, so the user always knows which TikTok account will receive the post.
- **video.publish** — When the user chooses "Publish directly", we call creator_info, show the creator's nickname, the privacy options returned by TikTok (no default selected), the comment/duet/stitch toggles (unchecked by default, disabled when the creator turned them off), the commercial content disclosure, and the Music Usage Confirmation notice. The video is posted only after the user presses Publish or the scheduled time they picked arrives.
- **video.upload** — When the user chooses "Send as draft", we upload the video to the user's TikTok inbox; the user finishes editing and posts from the TikTok app.

## Roteiro do vídeo de demonstração (gravar no sandbox, URL visível o tempo todo)

1. Abrir `https://<domínio>/`, rolar a home, abrir Termos e Privacidade pelo rodapé.
2. Clicar em **Testar grátis**, criar conta marcando o aceite dos termos.
3. Ir em **Contas → TikTok → Conectar**, mostrar a tela de login/autorização do TikTok com os escopos, autorizar e voltar com a conta conectada.
4. Em **Novo post**: enviar um vídeo, escolher a conta TikTok, escrever a legenda.
5. No bloco **Opções do TikTok**, mostrar em sequência:
   - "Publicando no TikTok como <nickname>";
   - o seletor de privacidade **vazio** e o botão bloqueado até escolher;
   - Comentários / Duet / Stitch desmarcados;
   - ligar **Divulgar conteúdo comercial**, mostrar o aviso pedindo a escolha, marcar "Sua marca" (rótulo "Conteúdo promocional") e depois "Conteúdo de marca" (rótulo "Parceria paga", "Só eu" fica indisponível);
   - o texto de concordância com a Music Usage Confirmation (e a Branded Content Policy).
6. Publicar, mostrar o aviso de que o TikTok pode levar alguns minutos, o status "Publicado" em Publicações e o vídeo no app do TikTok.
7. Repetir rapidamente com **Enviar como rascunho** e mostrar a notificação no app.
8. Em **Contas**, desconectar o TikTok.

## Auditoria do Direct Post (depois da revisão do app)

- Estimativa de uso: número de criadores por dia e posts por dia (começar baixo, ex.: 20 criadores/dia).
- Reaproveitar o vídeo acima; o formulário pergunta sobre cada item das [Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines).
