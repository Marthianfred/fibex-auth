FROM oven/bun:alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json bun.lock turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

RUN bun install --frozen-lockfile

COPY apps/backend ./apps/backend
COPY apps/frontend ./apps/frontend

FROM oven/bun:alpine
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY --from=builder /app/package.json /app/bun.lock /app/turbo.json ./
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/apps/frontend/package.json ./apps/frontend/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend ./apps/backend

EXPOSE 3000
CMD ["bun", "run", "--cwd", "apps/backend", "src/index.ts"]
