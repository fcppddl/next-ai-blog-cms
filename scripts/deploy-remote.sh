#!/usr/bin/env bash
# AIGC START
# 在 Ubuntu + nvm 环境下由 GitHub Actions SSH 调用。
# 非交互 shell 不会走 .bashrc 里「仅交互才加载」的分支，因此直接 source nvm.sh；
# 仅加载 nvm 还不够时，需 nvm use 才会把 node/npm 放进 PATH。
# 独立脚本避免在 workflow YAML 里转义 $ 导致远程解析错误。
set -eo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

deps_fingerprint() {
  # 同时考虑 Node 版本与锁文件，避免 Node 升级后复用旧依赖
  local node_v lock_hash
  node_v="$(node -v 2>/dev/null || true)"
  if command -v shasum >/dev/null 2>&1; then
    lock_hash="$(shasum -a 256 package-lock.json package.json 2>/dev/null | shasum -a 256 | awk '{print $1}')"
  else
    lock_hash="$(sha256sum package-lock.json package.json 2>/dev/null | sha256sum | awk '{print $1}')"
  fi
  echo "${node_v}:${lock_hash}"
}

install_deps_if_needed() {
  local cache_dir cache_file current_fp previous_fp
  cache_dir="$ROOT/.deploy-cache"
  cache_file="$cache_dir/npm-deps.fingerprint"
  mkdir -p "$cache_dir"

  current_fp="$(deps_fingerprint)"
  previous_fp=""
  if [ -f "$cache_file" ]; then
    previous_fp="$(cat "$cache_file" 2>/dev/null || true)"
  fi

  if [ -d "$ROOT/node_modules" ] && [ -f "$ROOT/package-lock.json" ] && [ "$current_fp" = "$previous_fp" ]; then
    echo "deploy-remote: 依赖未变更，跳过 npm ci"
    # npm ci 被跳过时，仍确保 Prisma Client 可用（很快且幂等）
    npm run postinstall >/dev/null 2>&1 || true
    return 0
  fi

  echo "deploy-remote: 依赖有变更（或首次部署），执行 npm ci"
  npm ci
  echo "$current_fp" > "$cache_file"
}

ensure_npm() {
  if command -v npm >/dev/null 2>&1; then
    return 0
  fi

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
    # 与仓库 Node 版本对齐（若存在 .nvmrc）
    if [ -f "$ROOT/.nvmrc" ]; then
      nvm install >/dev/null 2>&1 || true
      nvm use >/dev/null 2>&1 || true
    fi
    nvm use default >/dev/null 2>&1 || nvm use node >/dev/null 2>&1 || true
  fi
  if command -v npm >/dev/null 2>&1; then
    return 0
  fi

  # Ubuntu 默认 .bashrc 对非交互 shell 会立刻 return，source 也加载不到 nvm，故以上已直接读 nvm.sh。

  if [ -f "$HOME/.profile" ]; then
    # shellcheck disable=SC1090
    . "$HOME/.profile"
  fi
  if command -v npm >/dev/null 2>&1; then
    return 0
  fi

  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)"
  fi
  if command -v npm >/dev/null 2>&1; then
    return 0
  fi

  export PATH="/usr/local/bin:/usr/bin:$PATH"
  command -v npm >/dev/null 2>&1
}

ensure_npm || {
  echo "deploy-remote: npm 未找到。请在服务器确认: which npm（FinalShell 里）与 SSH 自动化使用同一用户（如 ubuntu）。" >&2
  exit 127
}

install_deps_if_needed
# 与 ecosystem 中 dotenv 一致，使用 .env.production（勿用 db:push，其读 .env.local）
npm run db:push:prod
npm run build
pm2 startOrReload ecosystem.config.js --update-env
# AIGC END
