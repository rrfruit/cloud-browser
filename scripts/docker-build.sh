#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 参数: push | no-push，默认 push
# 用法: ./scripts/docker-build.sh [push|no-push]
PUSH_ARG="${1:-push}"
case "$PUSH_ARG" in
  push|1) PUSH=1 ;;
  no-push|0) PUSH=0 ;;
  -h|--help)
    echo "用法: $0 [push|no-push]"
    echo "  push    构建并推送到 registry（默认）"
    echo "  no-push 仅构建，不推送"
    echo ""
    echo "环境变量示例:"
    echo "  VERSION=1.0.0 $0                   # 指定镜像版本"
    echo "  APT_MIRROR=mirrors.aliyun.com $0   # 国内加速 apt"
    echo "  PLATFORMS=linux/amd64 $0           # 仅构建 amd64"
    exit 0
    ;;
  *)
    echo "用法: $0 [push|no-push]，使用 -h 查看帮助"
    exit 1
    ;;
esac

REGISTRY="${REGISTRY:-crpi-qfk4dgj1rj1n76zn.cn-shenzhen.personal.cr.aliyuncs.com}"
REPOSITORY="${REPOSITORY:-rrfruit/cloud-browser}"
IMAGE_BASE="${REGISTRY}/${REPOSITORY}"
# 优先 VERSION，其次 TAG，最后回退 package.json version
VERSION="${VERSION:-${TAG:-$(node -e "console.log(require('${PROJECT_ROOT}/package.json').version)")}}"
REMOTE_IMAGE="${IMAGE_BASE}:${VERSION}"
LATEST_IMAGE="${IMAGE_BASE}:latest"

cd "$PROJECT_ROOT"

# 主流架构: amd64 + arm64
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
echo "Building image: ${REMOTE_IMAGE} (${PLATFORMS}) $([ "$PUSH" = "1" ] && echo "[push]" || echo "[no push]")"

docker buildx create --use --name multiarch-builder >/dev/null 2>&1 || docker buildx use multiarch-builder >/dev/null 2>&1
docker buildx inspect --bootstrap >/dev/null

if [ "$PUSH" = "1" ]; then
  docker buildx build \
    --platform "${PLATFORMS}" \
    ${APT_MIRROR:+--build-arg APT_MIRROR=$APT_MIRROR} \
    -t "${REMOTE_IMAGE}" \
    -t "${LATEST_IMAGE}" \
    --push .
else
  if [[ "${PLATFORMS}" == *","* ]]; then
    echo "no-push 模式不支持一次 load 多架构，请设置单架构平台（如 PLATFORMS=linux/amd64）。"
    exit 1
  fi
  docker buildx build \
    --platform "${PLATFORMS}" \
    ${APT_MIRROR:+--build-arg APT_MIRROR=$APT_MIRROR} \
    -t "${REMOTE_IMAGE}" \
    --load .
fi

echo "Done. Image: ${REMOTE_IMAGE}"
if [ "$PUSH" = "1" ]; then
  echo "Also pushed: ${LATEST_IMAGE}"
fi
