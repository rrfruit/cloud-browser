FROM zenika/alpine-chrome:with-node

USER 0
RUN apk add --no-cache xvfb x11vnc novnc fluxbox
USER chrome

ENV DISPLAY=:99 \
    XVFB_WHD=1280x720x16 \
    VIEWPORT_WIDTH=1280 \
    VIEWPORT_HEIGHT=720 \
    VNC_PORT=5900 \
    NOVNC_PORT=6080 \
    VNC_PASSWORD=password

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD 1
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser

COPY --chown=chrome package.json package-lock.json ./
RUN npm install --omit=dev

COPY --chown=chrome src/ ./src/

EXPOSE 3000
EXPOSE 6080
EXPOSE 9222

COPY --chown=chrome docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]
CMD ["node", "src/main.js"]
