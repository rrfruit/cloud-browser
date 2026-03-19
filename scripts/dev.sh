#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

IMAGE_NAME="cloud-browser:dev"
CONTAINER_NAME="cloud-browser-dev"

cd "$PROJECT_ROOT"

echo "==> 构建本地镜像: ${IMAGE_NAME}"
docker build -t "${IMAGE_NAME}" .

# 停止并删除已有的同名容器
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "==> 清理旧容器: ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}"
fi

echo "==> 启动容器: ${CONTAINER_NAME}"
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p 3000:3000 \
  -p 6080:6080 \
  -p 9222:9222 \
  "${IMAGE_NAME}"

echo ""
echo "容器已启动:"
echo "  应用接口:      http://localhost:3000"
echo "  noVNC 界面:    http://localhost:6080/vnc.html  (密码: password)"
echo "  Chrome 调试:   http://localhost:9222"
echo ""
echo "查看日志: docker logs -f ${CONTAINER_NAME}"
echo "停止容器: docker rm -f ${CONTAINER_NAME}"
