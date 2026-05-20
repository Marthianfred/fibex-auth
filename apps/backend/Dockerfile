FROM oven/bun:alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

# Copy root config
COPY package.json bun.lock turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

RUN bun install --frozen-lockfile

# Copy source code
COPY apps/backend ./apps/backend
COPY apps/frontend ./apps/frontend

# Runtime
FROM oven/bun:alpine
WORKDIR /app

# Python + build tools needed for better-sqlite3 native module
# (pulled by better-auth-dashboard -> @better-auth/cli at runtime)
RUN apk add --no-cache python3 make g++

# Copy monorepo structure with deps
COPY --from=builder /app/package.json /app/bun.lock /app/turbo.json ./
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/apps/frontend/package.json ./apps/frontend/
COPY --from=builder /app/node_modules ./node_modules

# Copy backend source
COPY --from=builder /app/apps/backend ./apps/backend

EXPOSE 3000
CMD ["bun", "run", "--cwd", "apps/backend", "src/index.ts"]
