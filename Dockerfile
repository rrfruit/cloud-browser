# 强烈建议使用 Ubuntu 22.04 版本的基础镜像
FROM jlesage/baseimage-gui:ubuntu-22.04-v4

# 1. 设置环境变量 (这会显示在网页的 Title 上)
ENV APP_NAME="Playwright Node Service"

# Chromium system deps + Node.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdbus-1-3 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libx11-xcb1 libfontconfig1 libx11-6 \
    libxcb1 libxext6 libxshmfence1 \
    libglib2.0-0 libgtk-3-0 libpangocairo-1.0-0 libcairo-gobject2 \
    libgdk-pixbuf-2.0-0 libxss1 libxtst6 fonts-liberation \
    xvfb xdotool \
    curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# # 2. 安装 Node.js (修复版：补充 CA 证书，确保成功拉取 NodeSource 脚本)
# RUN apt-get update && \
#     apt-get install -y curl ca-certificates gnupg && \
#     curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
#     apt-get install -y nodejs

# (可选：加一个验证步骤，防止以后再静默失败)
RUN node -v && npm -v

WORKDIR /app

COPY package.json tsconfig.json ensureBinary.js ./
RUN npm install

RUN node ensureBinary.js

COPY public ./public
COPY src ./src

RUN npm run build

COPY startapp.sh /startapp.sh
RUN chmod +x /startapp.sh

COPY rootfs/ /
RUN chmod +x /etc/cont-init.d/50-take-data-ownership.sh

