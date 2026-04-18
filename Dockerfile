# deps：postinstall 会执行 prisma generate，需先有 schema 与 openssl
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# 供运行阶段合并：仅保留 dependencies，含 prisma CLI 完整传递依赖
FROM deps AS prod_deps
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL="file:./prisma/build.db"
ENV NEXTAUTH_SECRET="build-placeholder-min-32-chars-long!!"
ENV NEXTAUTH_URL="http://localhost:3000"

RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 将生产依赖合并进 standalone 的 node_modules，保证 prisma db push 能解析 @prisma/engines、effect 等
COPY --from=prod_deps /app/node_modules /tmp/prod_node_modules
RUN cp -a /tmp/prod_node_modules/. ./node_modules/

COPY --from=builder /app/prisma ./prisma

COPY --from=builder /app/scripts/docker-init.mjs ./scripts/docker-init.mjs

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
