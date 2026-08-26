FROM node:22-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps/media-backend/package.json apps/media-backend/package.json
COPY packages/media-state/package.json packages/media-state/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @mrt/media-backend...

COPY apps/media-backend apps/media-backend
COPY packages/media-state packages/media-state
RUN pnpm --filter @mrt/media-backend... build
RUN pnpm deploy --filter @mrt/media-backend --prod --legacy /output

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /output ./
COPY --from=build /app/apps/media-backend/dist ./dist
COPY --from=build /app/packages/media-state/dist ./node_modules/@mrt/media-state/dist
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
