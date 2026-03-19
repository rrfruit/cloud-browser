FROM zenika/alpine-chrome:with-puppeteer

USER 0
RUN apk add --no-cache xvfb x11vnc novnc
USER chrome

ENV DISPLAY=:99 \
    XVFB_WHD=1280x720x16 \
    VNC_PORT=5900 \
    NOVNC_PORT=6080 \
    VNC_PASSWORD=password

COPY --chown=chrome package.json package-lock.json ./
RUN npm install --omit=dev

COPY --chown=chrome main.js ./

EXPOSE 3000
EXPOSE 6080
EXPOSE 9222

COPY --chown=chrome docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]
CMD ["node", "main.js"]
