# 基于 Alpine Linux + Chromium + Node.js 的精简镜像
FROM zenika/alpine-chrome:with-node

# 切换到 root 安装系统依赖，安装后恢复至非特权用户 chrome
USER 0
# xvfb: 虚拟帧缓冲，提供无头显示环境
# x11vnc: 将 X11 显示通过 VNC 协议共享
# novnc: 基于 WebSocket 的 VNC 客户端，可通过浏览器访问
# fluxbox: 轻量级窗口管理器，避免 Chromium 因无 WM 而崩溃
RUN apk add --no-cache xvfb x11vnc novnc fluxbox \
  && mkdir -p /data/chrome-profiles \
  && chown chrome:chrome /data/chrome-profiles
USER chrome
# 设置工作目录（与基础镜像保持一致，后续 COPY / RUN 均以此为相对路径基准）
WORKDIR /app

# 虚拟显示与视口配置
ENV DISPLAY=:99 \
    VIEWPORT_WIDTH=1366 \
    VIEWPORT_HEIGHT=768 \
    # VNC 原生协议端口（供 VNC 客户端直连）
    VNC_PORT=5900 \
    # noVNC WebSocket 端口（供浏览器访问）
    NOVNC_PORT=9221 \
    VNC_PASSWORD=password

# 跳过 Puppeteer 内置 Chromium 下载，直接使用镜像中已有的系统 Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD 1
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser
# Chromium user-data-dir 根目录；挂载卷到此路径以持久化配置与站点数据
ENV BROWSER_USER_DATA_ROOT=/data/chrome-profiles

# 优先单独拷贝依赖清单与 TS 配置，利用 Docker 层缓存加速后续构建
COPY --chown=chrome package.json package-lock.json tsconfig.json ./
RUN npm install

COPY --chown=chrome src/ ./src/
RUN npm run build && npm prune --omit=dev

# 9222: Node.js HTTP API 端口
# 9221: noVNC Web 访问端口
# 9223-9323: 每会话 CDP 端口池（与 CDP_PORT_MIN/MAX 一致，docker run 需映射整段）
ENV CDP_PORT_MIN=9223 \
    CDP_PORT_MAX=9323

EXPOSE 9221
EXPOSE 9222
EXPOSE 9223-9323/tcp

VOLUME ["/data/chrome-profiles"]

COPY --chown=chrome docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
