#!/bin/sh
set -e

echo "Starting Xvfb on display :99"
Xvfb :99 -ac -screen 0 "${XVFB_WHD:-1280x720x16}" -nolisten tcp &
sleep 1

echo "Starting x11vnc on port ${VNC_PORT:-5900}"
x11vnc -display :99 \
  -forever \
  -shared \
  -passwd "${VNC_PASSWORD:-password}" \
  -rfbport "${VNC_PORT:-5900}" \
  -bg -quiet

echo "Starting noVNC on port ${NOVNC_PORT:-6080}"
websockify --web /usr/share/novnc/ \
  "${NOVNC_PORT:-6080}" \
  "localhost:${VNC_PORT:-5900}" &

echo "noVNC available at http://localhost:${NOVNC_PORT:-6080}/vnc.html"
echo "Executing command $@"
exec "$@"
