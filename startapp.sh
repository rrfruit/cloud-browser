#!/bin/sh
# 完整的启动脚本 - 同时运行 Node.js 和 Firefox GUI

set -e

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "=== Starting Node.js + Firefox Controller ==="

# ============================================
# 1. 启动 D-Bus（Firefox 需要）
# ============================================
log "Starting D-Bus daemon..."
dbus-daemon --session --fork
export DBUS_SESSION_BUS_ADDRESS=session

# ============================================
# 2. 启动 Node.js API 服务（后台）
# ============================================
log "Starting Node.js API server..."
cd /app

# 确保 Node.js 进程能接收到信号
node main.js &
NODE_PID=$!
log "Node.js started with PID: $NODE_PID"

# ============================================
# 3. 准备 Firefox 配置文件（可选）
# ============================================
# 创建 Firefox 配置目录
mkdir -p /config/firefox
export HOME=/config

# ============================================
# 4. 信号处理 - 优雅关闭
# ============================================
cleanup() {
    log "Received shutdown signal, cleaning up..."
    
    # 关闭 Node.js
    if kill -0 $NODE_PID 2>/dev/null; then
        log "Stopping Node.js (PID: $NODE_PID)..."
        kill -TERM $NODE_PID
        wait $NODE_PID 2>/dev/null || true
    fi
    
    # 关闭所有 Firefox 进程
    log "Closing Firefox instances..."
    pkill -f firefox 2>/dev/null || true
    
    # 关闭 D-Bus
    pkill -f dbus-daemon 2>/dev/null || true
    
    log "Cleanup complete"
    exit 0
}

trap cleanup SIGTERM SIGINT SIGQUIT

# ============================================
# 5. 启动 GUI 环境（前台进程）
# ============================================
log "Starting Openbox window manager..."
log "Firefox will be available via VNC/Web browser at port 5800"

# 注意：基础镜像的 /init 已经启动了 VNC 和 noVNC
# 我们只需要启动窗口管理器，让 Firefox 可以显示

# 方式1：直接启动 Openbox（基础镜像期望的方式）
exec openbox-session

# 注意：exec 会替换当前进程，下面的代码不会执行
# 如果 openbox 退出，容器就会停止