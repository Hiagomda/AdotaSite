# Painel da equipe

Painel do Égua, adota! para a equipe moderar o app: denúncias, posts, verificação de ONG e protetor, pessoas, equipe e auditoria. Login só com usuário e senha.

O painel não tem banco. Ele conversa com a API do app (repositório `Hiagomda/adota`) pelo servidor do Next, que guarda a sessão num cookie `HttpOnly`. As rotas de moderação (`/admin/v1/...`) moram na API.

## Rodar

```bash
cp .env.example .env.local   # ADMIN_API_URL aponta para a API
pnpm install
pnpm dev                     # http://localhost:3020
```

`pnpm typecheck`, `pnpm lint` e `pnpm build` antes de enviar.

## Subir no Coolify

O serviço `admin` do `docker-compose.yml` da raiz sobe o painel em `https://admin-…sslip.io`, com `ADMIN_API_URL` apontando para a API do app. Na API do app (repositório `adota`) precisa estar `ADMIN_ORIGIN` com o endereço do painel.

## Criar um login

Os logins moram na API. No terminal do container da API (no Coolify) rode:

```bash
pnpm --filter @patinha/api staff:login -- --username hiago --name "Hiago" --role superadmin
```

A senha é pedida duas vezes no terminal (mínimo 12 caracteres). Rodar de novo com o mesmo usuário troca a senha e derruba as sessões abertas. Com `--handle <arroba>` o login fica ligado a uma conta que já existe no app.
