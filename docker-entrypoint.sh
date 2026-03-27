#!/bin/sh
# 容器启动入口：依次拉起虚拟显示、窗口管理器、VNC 服务，最后执行主进程
set -e

# 启动 Xvfb 虚拟帧缓冲，日志写入 /tmp/xvfb.log
# -ac: 禁用访问控制，允许任意客户端连接
# -nolisten tcp: 不监听 TCP（仅 Unix socket），减少安全面
# +extension RANDR: 启用屏幕尺寸动态调整扩展
echo "Starting Xvfb on display :99"
Xvfb "${DISPLAY}" -screen 0 1366x790x16 -ac -nolisten tcp +extension RANDR >/tmp/xvfb.log 2>&1 &
# 等待 Xvfb 初始化完成后再启动依赖它的服务
sleep 1

# 启动 Fluxbox 窗口管理器，Chromium 需要 WM 才能正常创建窗口
echo "Starting Fluxbox window manager"
fluxbox &
sleep 1

# 启动 x11vnc，将当前 X11 显示通过 VNC 协议暴露出去
# -forever: 客户端断开后不退出
# -shared:  允许多个客户端同时连接
# -bg:      后台运行
# -quiet:   抑制冗余日志
echo "Starting x11vnc on port ${VNC_PORT:-5900}"
x11vnc -display "${DISPLAY}" \
  -forever \
  -shared \
  -passwd "${VNC_PASSWORD:-password}" \
  -rfbport "${VNC_PORT:-5900}" \
  -bg -quiet

# 启动 noVNC (websockify)，将 VNC TCP 流量桥接为 WebSocket，
# 使用户可直接通过浏览器访问桌面
echo "Starting noVNC on port ${NOVNC_PORT:-9221}"
websockify --web /usr/share/novnc/ \
  "${NOVNC_PORT:-9221}" \
  "localhost:${VNC_PORT:-5900}" &

echo "noVNC available at http://localhost:${NOVNC_PORT:-9221}/vnc.html#password=${VNC_PASSWORD:-password}&autoconnect=true&reconnect=true&reconnect_delay=5000&resize=scale&view_only=false"
echo "Executing command $@"
# 用 exec 替换当前 shell 进程，使主进程成为 PID 1，确保信号能正确传递
exec "$@"
