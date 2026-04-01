# 强烈建议使用 Ubuntu 22.04 版本的基础镜像
FROM jlesage/baseimage-gui:ubuntu-22.04-v4

# 1. 设置环境变量 (这会显示在网页的 Title 上)
ENV APP_NAME="Playwright Node Service"

# 2. 安装 Node.js (修复版：补充 CA 证书，确保成功拉取 NodeSource 脚本)
RUN apt-get update && \
    apt-get install -y curl ca-certificates gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# (可选：加一个验证步骤，防止以后再静默失败)
RUN node -v && npm -v

WORKDIR /app

COPY package.json tsconfig.json ensureBinary.js ./
RUN npm install

RUN node ensureBinary.js

COPY src ./src

RUN npm run build

COPY startapp.sh /startapp.sh 
RUN chmod +x /startapp.sh

