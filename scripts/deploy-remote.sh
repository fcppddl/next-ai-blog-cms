#!/usr/bin/env bash
# 在 Ubuntu + nvm 环境下由 GitHub Actions SSH 调用。
# 非交互 shell 不会走 .bashrc 里「仅交互才加载」的分支，因此直接 source nvm.sh；
# 仅加载 nvm 还不够时，需 nvm use 才会把 node/npm 放进 PATH。
# 独立脚本避免在 workflow YAML 里转义 $ 导致远程解析错误。
set -eo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

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

npm ci
# 与 ecosystem 中 dotenv 一致，使用 .env.production（勿用 db:push，其读 .env.local）
npm run db:push:prod
npm run build
pm2 startOrReload ecosystem.config.js --update-env
