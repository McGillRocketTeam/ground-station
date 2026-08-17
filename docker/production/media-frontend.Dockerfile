FROM node:22-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps/media-frontend/package.json apps/media-frontend/package.json
COPY packages/map-style/package.json packages/map-style/package.json
COPY packages/media-state/package.json packages/media-state/package.json
COPY packages/yamcs-effect/package.json packages/yamcs-effect/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @mrt/media-frontend... \
    && pnpm rebuild esbuild

COPY apps/media-frontend apps/media-frontend
COPY packages/map-style packages/map-style
COPY packages/media-state packages/media-state
COPY packages/yamcs-effect packages/yamcs-effect

ARG VITE_YAMCS_INSTANCE=launch-canada
ARG VITE_YAMCS_PROCESSOR=realtime
RUN pnpm --filter @mrt/media-frontend... build

FROM nginx:1.29-alpine
COPY docker/production/nginx-media-frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/media-frontend/dist /usr/share/nginx/html
EXPOSE 8080
