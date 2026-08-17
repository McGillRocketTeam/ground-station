FROM node:22-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/map-style/package.json packages/map-style/package.json
COPY packages/media-state/package.json packages/media-state/package.json
COPY packages/yamcs-effect/package.json packages/yamcs-effect/package.json
COPY packages/yamcs-procedures/package.json packages/yamcs-procedures/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @mrt/frontend... \
    && pnpm rebuild esbuild

COPY apps/frontend apps/frontend
COPY packages/map-style packages/map-style
COPY packages/media-state packages/media-state
COPY packages/yamcs-effect packages/yamcs-effect
COPY packages/yamcs-procedures packages/yamcs-procedures

ARG MRT_ENVIRONMENT=production
ARG MRT_GOJS_API_KEY=""
ARG MQTT_BROKER_URL=ws://localhost:9001
ARG YAMCS_INSTANCE=launch-canada
ARG YAMCS_PROCESSOR=realtime
RUN pnpm --filter @mrt/frontend... build

FROM nginx:1.29-alpine
COPY docker/production/nginx-frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 8080
