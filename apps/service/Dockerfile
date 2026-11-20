FROM node:26-slim AS base
 
FROM base AS builder

WORKDIR /app

RUN npm install -g corepack && corepack enable pnpm
RUN npm install -g turbo@latest

COPY . .
 
RUN turbo prune service --docker
 
FROM base AS installer

RUN npm install -g corepack && corepack enable pnpm

WORKDIR /app
 
COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile
 
COPY --from=builder /app/out/full/ .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm turbo run build
 
FROM base AS runner

# ffmpeg powers the Conversion tools, heif-dec reads HEIC images, and headless LibreOffice with metric-compatible fonts turns documents into PDFs; updated with every image rebuild
RUN apt-get update && apt-get install -y --no-install-recommends \
  openssl ffmpeg libheif-examples libheif-plugin-libde265 \
  libreoffice-writer-nogui libreoffice-calc-nogui libreoffice-impress-nogui \
  fonts-liberation fonts-noto-core \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_PATH=/var/lib/vaze

COPY --from=installer /app/apps/service/.next/standalone ./
COPY --from=installer /app/apps/service/.next/static ./apps/service/.next/static
COPY --from=installer /app/apps/service/public ./apps/service/public
# Drizzle migrations are applied at runtime via migrate() (read from <cwd>/drizzle).
COPY --from=builder /app/apps/service/drizzle ./apps/service/drizzle
COPY --from=builder /app/apps/service/entrypoint.sh ./apps/service/entrypoint.sh

RUN chmod +x ./apps/service/entrypoint.sh

# Run unprivileged; a named volume at /var/lib/vaze inherits node's ownership on first use.
RUN mkdir -p /var/lib/vaze && chown node:node /var/lib/vaze && chown -R node:node /app

USER node

EXPOSE 3000
ENV PORT=3000
# Without this the standalone server binds to the container id only.
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./apps/service/entrypoint.sh"]
CMD ["node", "apps/service/server.js"]