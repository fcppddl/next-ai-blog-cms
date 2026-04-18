#!/bin/sh
# standalone 镜像通常没有 node_modules/.bin/prisma，改用 prisma 包内 CLI
set -e

mkdir -p /data
mkdir -p /app/public/images/covers
mkdir -p /app/public/images/posts

if [ -f "./node_modules/prisma/build/index.js" ]; then
  node ./node_modules/prisma/build/index.js db push --skip-generate
elif [ -x "./node_modules/.bin/prisma" ]; then
  ./node_modules/.bin/prisma db push --skip-generate
else
  echo "error: 未找到 prisma CLI，无法创建数据表" >&2
  exit 1
fi

if [ -f "./scripts/docker-init.mjs" ]; then
  node ./scripts/docker-init.mjs
fi

exec node server.js
