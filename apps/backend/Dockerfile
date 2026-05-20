FROM oven/bun:alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json bun.lock turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

RUN bun install --frozen-lockfile

COPY apps/backend ./apps/backend
COPY apps/frontend ./apps/frontend

RUN bun run --cwd apps/backend build

FROM oven/bun:alpine
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY apps/backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY --from=builder /app/apps/backend/server /server

EXPOSE 3000
CMD ["/entrypoint.sh"]
