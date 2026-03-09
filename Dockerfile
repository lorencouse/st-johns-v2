FROM oven/bun:1.3-slim AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN useradd --system --uid 1001 --no-create-home nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=1001:0 /app/.next/standalone ./
COPY --from=builder --chown=1001:0 /app/.next/static ./.next/static

# Drizzle migrations
COPY --from=builder /app/drizzle ./drizzle

USER nextjs
EXPOSE 3000

CMD ["bun", "server.js"]
