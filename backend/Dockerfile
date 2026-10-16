FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/ backend/
COPY shared/ shared/
COPY OpenMAIC/packages/@openmaic/dsl/ OpenMAIC/packages/@openmaic/dsl/
COPY OpenMAIC/packages/@openmaic/generation/ OpenMAIC/packages/@openmaic/generation/
COPY OpenMAIC/lib/server/identity/types.ts OpenMAIC/lib/server/identity/types.ts
COPY OpenMAIC/lib/server/identity/host/ola-training.ts OpenMAIC/lib/server/identity/host/ola-training.ts
RUN pnpm install --frozen-lockfile --filter ola-training-workspace --filter ola-training-backend...
RUN pnpm --filter @openmaic/dsl build && pnpm --filter @openmaic/generation build && pnpm --filter ola-training-backend build
RUN pnpm --filter ola-training-backend deploy --prod --legacy /runtime
FROM node:22-bookworm-slim
WORKDIR /app/backend
COPY --from=build /runtime/ ./
RUN mkdir -p /app/backend/data && chown -R node:node /app/backend/data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4190 DATA_DIR=/app/backend/data
EXPOSE 4190
CMD ["node", "dist/server.mjs"]
