FROM node:22-slim

WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

COPY apps/frontend/package.json apps/frontend/
COPY packages/yamcs-effect/package.json packages/yamcs-effect/
COPY packages/yamcs-atom/package.json packages/yamcs-atom/

RUN pnpm install --filter frontend...

COPY . .

EXPOSE 5173

CMD ["pnpm", "--filter", "frontend", "exec", "vite", "--host", "0.0.0.0", "--port", "5173"]
