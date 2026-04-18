#!/usr/bin/env bash
# 在服务器上由 GitHub Actions SSH 调用：拉取 Docker Hub 镜像并重启栈（需已配置 .env.docker）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${APP_IMAGE:?请导出 APP_IMAGE，例如 docker.io/你的用户名/仓库名:latest}"

resolve_docker_cmd() {
  if [ -n "${DOCKER_BIN:-}" ]; then
    # 例：DOCKER_BIN=/usr/bin/docker 或写成带空格的需自行 export 为数组场景；此处支持单路径
    echo "$DOCKER_BIN"
    return 0
  fi
  if docker info >/dev/null 2>&1; then
    echo "docker"
    return 0
  fi
  if sudo -n docker info >/dev/null 2>&1; then
    echo "sudo docker"
    return 0
  fi
  echo "错误：当前用户无法访问 Docker（/var/run/docker.sock 权限不足）。" >&2
  echo "请在服务器执行：sudo usermod -aG docker \"\$USER\"，断开 SSH 后重新连接，再重试部署。" >&2
  exit 1
}

DK_LINE="$(resolve_docker_cmd)"
# shellcheck disable=SC2206
DK=($DK_LINE)

if [ -d .git ] && [ "${DEPLOY_GIT_PULL:-1}" = "1" ]; then
  git fetch origin
  git checkout main 2>/dev/null || git checkout master 2>/dev/null || true
  git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || true
fi

# 私有仓库拉取需登录；公开镜像可不设 DOCKERHUB_TOKEN
if [ -n "${DOCKERHUB_TOKEN:-}" ]; then
  echo "$DOCKERHUB_TOKEN" | "${DK[@]}" login -u "${DOCKERHUB_USERNAME:?请导出 DOCKERHUB_USERNAME}" --password-stdin
fi

"${DK[@]}" compose --env-file .env.docker -f docker-compose.deploy.yml pull
"${DK[@]}" compose --env-file .env.docker -f docker-compose.deploy.yml up -d
