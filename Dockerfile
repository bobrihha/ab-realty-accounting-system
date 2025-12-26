# Multi-stage Dockerfile for Production Deployment
# Stage 1: Dependencies
# Stage 1: Dependencies
FROM node:20-slim AS deps
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm install

# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app
ARG NODE_OPTIONS="--max-old-space-size=3072"
ENV NODE_OPTIONS=$NODE_OPTIONS


COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 3: Runner
# Stage 3: Runner
FROM node:20-slim AS runner
WORKDIR /app
# bash is included in slim
RUN apt-get update -y && apt-get install -y openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/package.json ./package.json

# Create database directory
RUN mkdir -p /app/db && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
