# 基于 Alpine Linux + Firefox + Node.js 的运行镜像
FROM node:22-alpine

USER 0
RUN apk add --no-cache firefox xvfb x11vnc novnc fluxbox dbus \
    font-dejavu font-noto-cjk \
  && mkdir -p /data/firefox-profiles \
  && chown node:node /data/firefox-profiles

USER node
WORKDIR /app

ENV DISPLAY=:99 VIEWPORT_WIDTH=1366 VIEWPORT_HEIGHT=768 VNC_PORT=5900 NOVNC_PORT=9221 VNC_PASSWORD=password

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/firefox
ENV BROWSER_USER_DATA_ROOT=/data/firefox-profiles

COPY --chown=node:node package.json package-lock.json tsconfig.json ./
RUN npm install

COPY --chown=node:node src/ ./src/
RUN npm run build && npm prune --omit=dev

ENV CDP_PORT_MIN=9223 CDP_PORT_MAX=9323

EXPOSE 9221
EXPOSE 9222
EXPOSE 9223-9323/tcp

VOLUME ["/data/firefox-profiles"]

COPY --chown=node:node docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
