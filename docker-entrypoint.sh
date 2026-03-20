#!/bin/sh
set -e

echo "Starting Xvfb on display :99"
Xvfb "${DISPLAY}" -screen 0 "${XVFB_WHD}" -ac -nolisten tcp +extension RANDR >/tmp/xvfb.log 2>&1 &
sleep 1

echo "Starting Fluxbox window manager"
fluxbox &
sleep 1

echo "Starting x11vnc on port ${VNC_PORT:-5900}"
x11vnc -display "${DISPLAY}" \
  -forever \
  -shared \
  -passwd "${VNC_PASSWORD:-password}" \
  -rfbport "${VNC_PORT:-5900}" \
  -bg -quiet

echo "Starting noVNC on port ${NOVNC_PORT:-6080}"
websockify --web /usr/share/novnc/ \
  "${NOVNC_PORT:-6080}" \
  "localhost:${VNC_PORT:-5900}" &

echo "noVNC available at http://localhost:${NOVNC_PORT:-6080}/vnc.html#password=${VNC_PASSWORD:-password}"
echo "Executing command $@"
exec "$@"
