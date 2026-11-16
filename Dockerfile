# Vyralink + Creator Hub: one Dockerfile, three images.
#   docker build --target api    -t vyralink-api .
#   docker build --target worker -t vyralink-worker .
#   docker build --target web    -t vyralink-web .
# Runtime images hold production dependencies only and run as the unprivileged "node" user.

FROM node:24-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# ---- production dependencies (API + worker): no dev tools, no embedded Postgres
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace=@vyralink/api --workspace=@vyralink/worker --include-workspace-root=false --ignore-scripts && npm cache clean --force

# ---- web build: full dependencies, standalone Next.js output
FROM base AS web-build
ENV NODE_ENV=development NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=@vyralink/web --include-workspace-root=false --ignore-scripts
COPY apps/web apps/web
RUN cd apps/web && NODE_ENV=production npx next build

# ---- API: migrates on start, then serves /v1
FROM base AS api
COPY --from=prod-deps /app/node_modules ./node_modules
COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/api/migrations apps/api/migrations
ENV HOST=0.0.0.0 PORT=4020 STORAGE_DIR=/data/storage
RUN mkdir -p /data/storage && chown -R node:node /data
USER node
EXPOSE 4020
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:4020/v1/health || exit 1
# migrate.js also creates the super admin from ADMIN_EMAIL / ADMIN_PASSWORD (server.js only migrates)
CMD ["sh", "-c", "node apps/api/src/migrate.js && exec node apps/api/src/server.js"]

# ---- worker: email outbox and scheduled jobs from the Postgres job table
FROM base AS worker
COPY --from=prod-deps /app/node_modules ./node_modules
COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/worker/package.json apps/worker/
COPY apps/worker/src apps/worker/src
ENV DEV_MAIL_DIR=/data/mail
RUN mkdir -p /data/mail && chown -R node:node /data
USER node
CMD ["node", "apps/worker/src/index.js"]

# ---- web: Next.js standalone server (the browser only ever talks to this; it proxies /api to the API)
FROM base AS web
ENV HOSTNAME=0.0.0.0 PORT=3020 NEXT_TELEMETRY_DISABLED=1
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3020
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:3020/ >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
