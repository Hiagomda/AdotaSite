# Painel da equipe

Painel do Égua, adota! para a equipe moderar o app: denúncias, posts, verificação de ONG e protetor, pessoas, equipe e auditoria. Login com a conta do app e código do autenticador (TOTP).

O painel não tem banco. Ele conversa com a API do app (repositório `Hiagomda/adota`) pelo servidor do Next, que guarda a sessão num cookie `HttpOnly`. As rotas de moderação (`/admin/v1/...`) moram na API.

## Rodar

```bash
cp .env.example .env.local   # ADMIN_API_URL aponta para a API
pnpm install
pnpm dev                     # http://localhost:3020
```

`pnpm typecheck`, `pnpm lint` e `pnpm build` antes de enviar.

## Subir no Coolify

O serviço `admin` do `docker-compose.yml` da raiz sobe o painel em `https://admin-…sslip.io`, com `ADMIN_API_URL` apontando para a API do app. Na API do app (repositório `adota`) precisam estar `ADMIN_TOTP_KEY` (32 bytes em base64) e `ADMIN_ORIGIN` com o endereço do painel.
