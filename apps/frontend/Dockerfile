FROM oven/bun:alpine AS builder
WORKDIR /app

# Copy root config
COPY package.json bun.lock turbo.json ./
# Copy all workspace manifests
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install monorepo deps
RUN bun install --frozen-lockfile

# Copy source code
COPY apps/backend ./apps/backend
COPY apps/frontend ./apps/frontend

# Build frontend
RUN bun run --cwd apps/frontend build

# Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html index.htm; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
