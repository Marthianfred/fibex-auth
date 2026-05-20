FROM oven/bun:alpine AS builder
WORKDIR /app

COPY apps/backend/package.json ./
RUN bun install --production

COPY apps/backend/src ./src

FROM oven/bun:alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
