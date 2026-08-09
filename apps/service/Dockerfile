FROM node:24-alpine AS base
 
FROM base AS builder

RUN apk update
RUN apk add --no-cache libc6-compat 

WORKDIR /app

RUN corepack enable pnpm 
RUN npm install -g turbo@latest

COPY . .
 
RUN turbo prune service --docker
 
FROM base AS installer

RUN apk update
RUN apk add --no-cache libc6-compat
RUN corepack enable pnpm

WORKDIR /app
 
COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile
 
COPY --from=builder /app/out/full/ .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm turbo run build
 
FROM base AS runner

RUN apk update
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_PATH=/app/data

COPY --from=installer /app/apps/service/.next/standalone ./
COPY --from=installer /app/apps/service/.next/static ./apps/service/.next/static
COPY --from=installer /app/apps/service/public ./apps/service/public
# Drizzle migrations are applied at runtime via migrate() (read from <cwd>/drizzle).
COPY --from=builder /app/apps/service/drizzle ./apps/service/drizzle
COPY --from=builder /app/apps/service/entrypoint.sh ./apps/service/entrypoint.sh

RUN chmod +x ./apps/service/entrypoint.sh

# Run unprivileged. `node` (uid 1000) ships with the base image; a named volume
# mounted at /app/data inherits this ownership when Docker first creates it.
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000
ENV PORT=3000
# Without this the standalone server binds to the container id only.
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./apps/service/entrypoint.sh"]
CMD ["node", "apps/service/server.js"]