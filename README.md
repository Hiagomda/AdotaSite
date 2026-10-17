# Égua, adota! · site e painel

Site público e painel administrativo do app Égua, adota!, separados do repositório do app ([Hiagomda/adota](https://github.com/Hiagomda/adota)).

| Pasta    | O que é                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------ |
| `site/`  | Apresentação do app e download do APK. HTML estático servido por nginx.                          |
| `admin/` | Painel administrativo da equipe.                                                                 |

## Site

- `site/index.html`: abas Conheça (`#sobre`) e Baixar (`#baixar`).
- `site/version.json`: versão que o app lê ao abrir para oferecer atualização. Atualize a cada release.
- `site/Dockerfile`: o `ARG APK_URL` aponta para o APK do release `apk-<version>-<build>` no repositório do app. O container baixa o arquivo no build e serve em `/egua-adota.apk`.

Prévia local:

```bash
docker compose up --build site
```

O `docker-compose.yml` da raiz é o que o Coolify sobe. O endereço de download não pode mudar, porque os APKs instalados procuram atualização nele.
