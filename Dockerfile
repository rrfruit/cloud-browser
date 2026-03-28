# jlesage GUI stack (TigerVNC + noVNC + Openbox) + Firefox + Node API
FROM jlesage/baseimage-gui:alpine-3.23-v4.11.3

ARG FIREFOX_VERSION=

WORKDIR /tmp

RUN \
    if [ -n "$FIREFOX_VERSION" ]; then \
        add-pkg firefox=${FIREFOX_VERSION}; \
    else \
        add-pkg firefox; \
    fi && \
    add-pkg \
        nodejs \
        npm \
        font-dejavu \
        mesa-dri-gallium \
        libpulse

ENV WEB_LISTENING_PORT=9221 \
    VIEWPORT_WIDTH=1366 \
    VIEWPORT_HEIGHT=768 \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 \
    PUPPETEER_BROWSER=firefox \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/firefox \
    BROWSER_USER_DATA_ROOT=/data/chrome-profiles \
    CDP_PORT_MIN=9223 \
    CDP_PORT_MAX=9323 \
    MOZ_DISABLE_CONTENT_SANDBOX=1 \
    MOZ_DISABLE_GMP_SANDBOX=1 \
    MOZ_DISABLE_RDD_SANDBOX=1 \
    MOZ_DISABLE_SOCKET_PROCESS_SANDBOX=1

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build && npm prune --omit=dev

COPY rootfs/ /
RUN chmod +x \
    /startapp.sh \
    /etc/services.d/cloud-browser/run \
    /etc/cont-init.d/55-cloud-browser-uidgid.sh

RUN \
    mkdir -p /data/chrome-profiles && \
    take-ownership /app && \
    take-ownership /data/chrome-profiles

RUN set-cont-env APP_NAME "Cloud Browser"

EXPOSE 9221
EXPOSE 9222
EXPOSE 5900
EXPOSE 9223-9323/tcp

VOLUME ["/data/chrome-profiles"]
