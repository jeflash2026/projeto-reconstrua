# ─────────────────────────────────────────────────────────────────────────────
# AHRIOS — imagem de produção da API (webhook + admin + advogado + lx + produção).
# Build multi-stage; o container roda apps/api/dist/production/main.js, que valida
# o GO-LIVE (bloqueante) antes de escutar as portas.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @reconstrua/domain --filter @reconstrua/contracts --filter @reconstrua/application --filter @reconstrua/infrastructure --filter @reconstrua/api build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
# Migrations (MIG-01): arquivos .sql aplicados pelo runner dedicado (apps/api/dist/migrate/main.js).
COPY infrastructure/database ./infrastructure/database
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Portas: main / admin / advogado / lawyer-experience
EXPOSE 3001 3002 3003 3004
ENV PORT=3001
CMD ["node", "apps/api/dist/production/main.js"]

# ─────────────────────────────────────────────────────────────────────────────
# PORTAIS (Next.js) — plataforma inteira em UM domínio, sob subpath (basePath):
#   /admin    → portal-administracao (:3100) — inclui a página do Perito (/admin/pericias)
#   /advogado → portal-advogado (:3200)
# Build compartilhado; targets separados por serviço (compose: build.target).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS portal-build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
# Workspace COMPLETO: com importers parciais o pnpm re-resolvia os @types e os
# builds falhavam com erros de tipo que não existem no local/CI.
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/portal-administracao ./apps/portal-administracao
COPY apps/portal-advogado ./apps/portal-advogado
COPY apps/portal-cliente ./apps/portal-cliente
COPY apps/portal-perito ./apps/portal-perito
COPY apps/landing-web ./apps/landing-web
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @reconstrua/portal-administracao --filter @reconstrua/portal-advogado --filter @reconstrua/portal-cliente --filter @reconstrua/portal-perito --filter @reconstrua/landing-web build

FROM portal-build AS portal-admin
ENV NODE_ENV=production
EXPOSE 3100
CMD ["pnpm", "--filter", "@reconstrua/portal-administracao", "start"]

FROM portal-build AS portal-advogado
ENV NODE_ENV=production
EXPOSE 3200
CMD ["pnpm", "--filter", "@reconstrua/portal-advogado", "start"]

FROM portal-build AS portal-cliente
ENV NODE_ENV=production
EXPOSE 3300
CMD ["pnpm", "--filter", "@reconstrua/portal-cliente", "start"]

# Decreto 2026-07-21: Portal do PERITO — apartado do Admin (basePath /perito).
FROM portal-build AS portal-perito
ENV NODE_ENV=production
EXPOSE 3400
CMD ["pnpm", "--filter", "@reconstrua/portal-perito", "start"]

# Decreto 2026-07-21: LANDING nova (Next 15) — a raiz pública do domínio.
FROM portal-build AS landing-web
ENV NODE_ENV=production
EXPOSE 3500
CMD ["pnpm", "--filter", "@reconstrua/landing-web", "start"]
