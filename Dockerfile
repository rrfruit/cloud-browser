FROM jlesage/baseimage-gui:alpine-3.19-v4

# ============================================
# 安装 Firefox 和 Node.js
# ============================================
RUN apk add --no-cache \
    # Firefox 浏览器
    firefox \
    # Node.js 环境
    nodejs \
    npm \
    # Firefox 运行依赖
    dbus \
    # 中文字体支持（可选）
    font-noto-cjk \
    # 额外的图形依赖
    mesa-gl \
    mesa-dri-gallium

# ============================================
# 环境变量配置
# ============================================
ENV DISPLAY=:0 \
    APP_NAME="Node.js + Firefox Controller" \
    # Firefox 配置
    MOZ_ENABLE_WAYLAND=0 \
    MOZ_LEGACY_PROFILES=1

# ============================================
# 准备 Node.js 应用
# ============================================
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build && npm prune --omit=dev

# ============================================
# 创建自定义启动脚本
# ============================================
COPY startapp.sh /startapp.sh
RUN chmod +x /startapp.sh

# ============================================
# 暴露端口
# ============================================
# 5800: Web GUI (noVNC)
# 5900: VNC 客户端
# 9222: Node.js API
# 9223-9323: Debug ports
EXPOSE 5800
EXPOSE 9222
EXPOSE 9223-9323/tcp

# 使用基础镜像的默认用户
USER 1000