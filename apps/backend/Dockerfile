FROM oven/bun:alpine AS builder
WORKDIR /app
COPY package.json bun.lock turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
RUN bun install --frozen-lockfile
COPY apps/backend ./apps/backend
RUN bun run --cwd apps/backend build

FROM oven/bun:alpine
WORKDIR /app
COPY --from=builder /app/apps/backend/server ./server
EXPOSE 3000
CMD ["./server"]
