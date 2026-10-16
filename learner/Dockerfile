FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY learner/ learner/
COPY shared/ shared/
COPY packages/classroom-ui/ packages/classroom-ui/
COPY packages/learner-client/ packages/learner-client/
COPY OpenMAIC/packages/@openmaic/dsl/ OpenMAIC/packages/@openmaic/dsl/
COPY OpenMAIC/packages/@openmaic/renderer/ OpenMAIC/packages/@openmaic/renderer/
COPY OpenMAIC/packages/@openmaic/editor/ OpenMAIC/packages/@openmaic/editor/
RUN pnpm install --frozen-lockfile --filter ola-training-workspace --filter ola-training-learner...
RUN pnpm --filter @openmaic/dsl build && pnpm --filter @openmaic/renderer build && pnpm --filter @openmaic/editor build
RUN pnpm --filter ola-training-learner build
FROM nginx:1.27-alpine
COPY learner/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/learner/dist /usr/share/nginx/html
