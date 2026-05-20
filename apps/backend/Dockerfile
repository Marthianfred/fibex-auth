FROM oven/bun:alpine AS builder
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy root config
COPY package.json bun.lock turbo.json ./
# Copy all workspace manifests to allow Bun to link them correctly
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install everything (Bun linked monorepo)
RUN bun install --frozen-lockfile

# Copy source code
COPY apps/backend ./apps/backend
COPY apps/frontend ./apps/frontend

# Build the app we want
RUN bun run --cwd apps/backend build

# Runtime
FROM oven/bun:alpine
WORKDIR /app
COPY --from=builder /app/apps/backend/server ./server
EXPOSE 3000
CMD ["./server"]
