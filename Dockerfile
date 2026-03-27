# 基于 Alpine Linux + Firefox + Node.js 的精简镜像
FROM node:20-alpine

# 安装 Firefox 和相关依赖
RUN apk add --no-cache \
    # Firefox 浏览器
    firefox \
    # 中文字体支持
    font-noto-cjk \
    ttf-freefont \
    fontconfig \
    # X11 相关（提供虚拟显示环境）
    xvfb \
    x11vnc \
    # 轻量级窗口管理器，避免 Firefox 因无 WM 而崩溃
    fluxbox \
    # noVNC 依赖（基于 WebSocket 的 VNC 客户端）
    python3 \
    py3-numpy \
    # 工具类
    bash \
    curl \
    dbus \
    dbus-x11 \
    # 构建工具（用于后续编译）
    g++ \
    make \
    python3-dev \
    && ln -sf python3 /usr/bin/python \
    && rm -rf /var/cache/apk/*

# 安装 noVNC（从 GitHub 克隆最新版本）
RUN git clone https://github.com/novnc/noVNC.git /opt/novnc \
    && git clone https://github.com/novnc/websockify /opt/novnc/utils/websockify \
    && chmod +x /opt/novnc/utils/novnc_proxy \
    && ln -sf /opt/novnc/vnc.html /opt/novnc/index.html

# 创建必要目录并设置权限
RUN mkdir -p /data/firefox-profiles \
    && mkdir -p /var/run/dbus \
    && chown -R node:node /data/firefox-profiles

# 设置工作目录
WORKDIR /app

# 环境变量配置
ENV DISPLAY=:99 \
    VIEWPORT_WIDTH=1366 \
    VIEWPORT_HEIGHT=768 \
    # VNC 原生协议端口（供 VNC 客户端直连）
    VNC_PORT=5900 \
    # noVNC WebSocket 端口（供浏览器访问）
    NOVNC_PORT=9221 \
    VNC_PASSWORD=password \
    # Firefox 配置
    FIREFOX_PROFILE_DIR=/data/firefox-profiles \
    # 语言设置
    LANG=zh_CN.UTF-8 \
    LANGUAGE=zh_CN:zh \
    LC_ALL=zh_CN.UTF-8 \
    # Node.js 环境
    NODE_ENV=production

# 配置中文字体
RUN fc-cache -fv

# 复制 package.json 和依赖文件
COPY --chown=node package.json package-lock.json tsconfig.json ./
RUN npm install --production=false

# 复制源代码并构建
COPY --chown=node src/ ./src/
RUN npm run build && npm prune --omit=dev

# API 端口配置
# 9222: Node.js HTTP API 端口
# 9221: noVNC Web 访问端口
# 9223-9323: 每个 Firefox 会话的 CDP 端口池（如果使用 Puppeteer/RDV）
ENV CDP_PORT_MIN=9223 \
    CDP_PORT_MAX=9323

EXPOSE 9221
EXPOSE 9222
EXPOSE 9223-9323/tcp

VOLUME ["/data/firefox-profiles"]

# 复制启动脚本
COPY --chown=node docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]