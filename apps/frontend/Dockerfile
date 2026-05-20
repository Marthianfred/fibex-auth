FROM oven/bun:1.1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock turbo.json ./
COPY apps/frontend/package.json ./apps/frontend/
RUN bun install --frozen-lockfile
COPY apps/frontend ./apps/frontend
RUN bun run --cwd apps/frontend build

FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html index.htm; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
