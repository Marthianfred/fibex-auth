FROM oven/bun:alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY apps/backend/package.json ./
RUN bun install --production

COPY apps/backend/src ./src
RUN bun build ./src/index.ts --compile --outfile server

FROM oven/bun:alpine
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY --from=builder /app/server ./server

EXPOSE 3000
CMD ["./server"]
