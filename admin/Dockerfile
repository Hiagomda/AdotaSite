FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Host do imgproxy para a CSP das miniaturas (entra no build do Next).
ARG ADMIN_MEDIA_ORIGIN=http://localhost:8080
ENV ADMIN_MEDIA_ORIGIN=$ADMIN_MEDIA_ORIGIN
RUN pnpm build && pnpm prune --prod

FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3020
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3020/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
# ADMIN_API_URL aponta para a API do app (ex.: http://api-....sslip.io ou http://api:3010).
CMD ["pnpm", "start"]
