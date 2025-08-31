FROM node:22-alpine AS base
 
FROM base AS builder

RUN apk update
RUN apk add --no-cache libc6-compat 

WORKDIR /app

RUN corepack enable pnpm 
RUN npm install -g turbo@latest

COPY . .
 
# Generate a partial monorepo with a pruned lockfile for a target workspace.
RUN turbo prune service --docker
 
# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer

RUN apk update
RUN apk add --no-cache libc6-compat
RUN corepack enable pnpm

WORKDIR /app
 
# First install the dependencies (as they change less often)
COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile
 
# Build the project
COPY --from=builder /app/out/full/ .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm turbo run build
 
FROM base AS runner

RUN apk update
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=installer /app/apps/service/.next/standalone ./
COPY --from=installer /app/apps/service/.next/static ./apps/service/.next/static
COPY --from=installer /app/apps/service/public ./apps/service/public
COPY --from=builder /app/apps/service/entrypoint.sh ./apps/service/entrypoint.sh

RUN chmod +x ./apps/service/entrypoint.sh

EXPOSE 3000
ENV PORT=3000

ENTRYPOINT ["./apps/service/entrypoint.sh"]
CMD ["node", "apps/service/server.js"]