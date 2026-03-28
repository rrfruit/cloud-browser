# cloud-browser

在服务器上按需启动 **Firefox**（默认）或 **Chromium** 实例，通过 HTTP API 返回调试 **WebSocket 地址**（`wsEndpoint`）：Firefox 使用 **WebDriver BiDi**，Chrome 使用 **CDP**。支持 **多会话并行**、**不透明票据** 与 **30 秒滑动续期**；Docker 镜像基于 **jlesage/baseimage-gui**，通过 Web 或 VNC 查看桌面。

## 功能概览

- 按客户端指定的 `sessionId` 创建独立浏览器进程（同一时刻 **活跃会话内 `sessionId` 不可重复**）。
- 创建响应返回 `wsEndpoint`、`ticket`、`expiresAt`；续期、关闭须携带正确 `ticket`。
- 自上次创建或成功续期起 **30 秒内无续期则自动关闭** 该会话浏览器。
- 默认 **Firefox**：不加载 stealth；`PUPPETEER_BROWSER=chrome` 时使用 `puppeteer-extra` + stealth。
- **调试端口池**：在 `CDP_PORT_MIN`～`CDP_PORT_MAX`（默认 9223–9323）内为每个会话分配独立远程调试端口，便于 Docker **1:1 映射整段端口**；返回的 `wsEndpoint` 可选经 `PUBLIC_WS_HOST` 改写主机名。
- Docker 镜像使用 **jlesage/baseimage-gui**（TigerVNC + noVNC + Openbox），不再自管 Xvfb/websockify。

## 本地开发

依赖：Node.js 18+、已安装的 Firefox 或 Chromium（设置 `PUPPETEER_EXECUTABLE_PATH` 与 `PUPPETEER_BROWSER`）或使用项目 Docker 镜像。

```bash
npm install
npm run build
npm start
```

默认监听 `PORT`（未设置时为 **9222**）。

## HTTP API

基础路径：`/browser`（健康检查：`GET /health` → `{ "status": "ok" }`）。

### `GET /browser/status`

返回当前内存中的会话数量。

**响应示例**

```json
{ "sessionCount": 2 }
```

### `POST /browser/session`

创建会话并启动 Chromium。

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sessionId` | string | 是 | 客户端唯一标识；trim 后长度 1～128，仅允许 `[\w.-]`（字母、数字、`_`、`.`、`-`） |
| `args` | string[] | 否 | 追加传给 Chromium 的命令行参数 |

**成功 `201`**

```json
{
  "sessionId": "your-id",
  "ticket": "<64-byte hex>",
  "wsEndpoint": "ws://...",
  "cdpPort": 9223,
  "expiresAt": 1792220000000
}
```

`cdpPort` 为该会话在容器（或本机）内占用的 **Chrome 远程调试 TCP 端口**；若使用 `docker run -p 9223-9323:9223-9323` 这类 **同号段映射**，宿主机上连接同一端口即可。

**错误**

| 状态码 | `error` | 含义 |
|--------|---------|------|
| 400 | `INVALID_SESSION_ID` | `sessionId` 缺失或格式非法 |
| 409 | `SESSION_ID_IN_USE` | 该 `sessionId` 已有活跃会话（或正在创建中） |
| 503 | `CDP_PORTS_EXHAUSTED` | 端口池内无可用端口（并发会话已达上限或端口被占用） |

会话关闭或过期后，可 **再次使用同一 `sessionId`** 创建新会话。

### `POST /browser/session/:id/renew`

滑动续期 30 秒（从当前时刻重新计时）。

**请求体**

```json
{ "ticket": "<创建时返回的 ticket>" }
```

**成功 `200`**：`{ "expiresAt": <number> }`  

**错误**：`404` + `NOT_FOUND`（无此会话）；`401` + `UNAUTHORIZED`（票据错误）。

### `POST /browser/session/:id/close`

立即关闭会话并作废票据。

**请求体**：同 renew，需 `{ "ticket": "..." }`。  

**成功 `200`**：`{ "closed": true }`。错误码含义同 renew。

## 连接调试协议（Firefox WebDriver BiDi / Chrome CDP）

创建成功后，在 **能直连 `cdpPort` 对应 TCP 端口** 的网络内使用返回的 `wsEndpoint`。Firefox 会话使用 **WebDriver BiDi**（非 CDP）；Chrome 会话为 CDP。容器请映射与 `CDP_PORT_MIN`/`CDP_PORT_MAX` 一致的端口段（例如 `-p 9223-9323:9223-9323`）。

若客户端访问的主机名与容器内不一致（例如经公网 IP 访问），设置 **`PUBLIC_WS_HOST`**（仅替换 `wsEndpoint` 的 **hostname**，端口不变，适用于 1:1 端口映射）。

常见用法：`puppeteer.connect({ browserWSEndpoint })`（需与浏览器协议一致）。

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `PORT` | HTTP 服务端口 | `9222` |
| `PUPPETEER_EXECUTABLE_PATH` | 浏览器可执行文件路径（镜像内 Firefox） | 镜像内置 `/usr/bin/firefox` |
| `PUPPETEER_BROWSER` | `firefox` 或 `chrome`（仅 `chrome` 时加载 stealth 插件） | `firefox` |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` / `PUPPETEER_SKIP_DOWNLOAD` | 跳过 Puppeteer 自带浏览器下载 | 镜像内置 `1` |
| `FIREFOX_REMOTE_ALLOW_HOSTS` | Firefox `--remote-allow-hosts`（逗号分隔）；非本机连接调试端口时可设 | 未设置 |
| `VIEWPORT_WIDTH` / `VIEWPORT_HEIGHT` | 启动参数中的窗口尺寸 | `1366` / `768` |
| `BROWSER_USER_DATA_ROOT` | 各会话 `user-data-dir` 的父目录（持久化配置与站点数据） | `/tmp`；Docker 镜像为 `/data/chrome-profiles` |
| `CDP_PORT_MIN` / `CDP_PORT_MAX` | 远程调试端口闭区间；池大小即最大并发会话数 | `9223` / `9323` |
| `PUBLIC_WS_HOST` | 若设置，创建会话返回的 `wsEndpoint` 会把主机名改为该值（不含协议） | 未设置则多为 `127.0.0.1` |

Docker 基于 [jlesage/baseimage-gui](https://github.com/jlesage/docker-baseimage-gui)：Web 访问桌面默认端口为 `WEB_LISTENING_PORT`（镜像内 `9221`），原生 VNC 为 `VNC_LISTENING_PORT`（默认 `5900`），密码见 `VNC_PASSWORD`。HTTP API 由 s6 拉起后通过 **`s6-setuidgid app`** 以 jlesage 的 **`app` 用户**（与 `USER_ID`/`GROUP_ID` 一致）运行 Node，避免 Firefox 报 “root + XDG_RUNTIME_DIR 属 app”；Firefox 另设 `extraPrefsFirefox` 降低内容沙箱级别，镜像内还有 `MOZ_DISABLE_*`，减轻容器里 `clone()` EPERM。

## Docker

构建：

```bash
docker build -t cloud-browser .
```

运行（映射 API、Web 桌面、VNC、调试端口，并 **持久化** 用户数据目录）：

```bash
docker run --rm \
  -p 9222:9222 \
  -p 9221:5900 \
  -p 9223-9323:9223-9323 \
  -v cloud-browser-profiles:/data/chrome-profiles \
  cloud-browser
```

- **API**：`http://localhost:9222`
- **noVNC**（默认）：`http://localhost:9221/vnc.html`（密码见环境变量 `VNC_PASSWORD`，默认 `password`）

项目提供 `./scripts/dev.sh`，会构建镜像并以前述端口启动开发容器（未挂载卷时，容器内配置仍写入声明的 volume 目录，重启容器可能丢失数据；生产环境请挂载卷）。

## TypeScript SDK（外部调用）

仓库内 npm 包 **`cloud-browser-sdk`** 位于 [`sdk/`](./sdk/)，安装、API 说明与示例见 **[sdk/README.md](./sdk/README.md)**。根目录可执行 `npm run build:sdk` 单独编译 SDK。

## 集成测试脚本

服务已启动且本机可启动 Chromium 时：

```bash
node scripts/verify-session-api.mjs
# 或
BASE_URL=http://127.0.0.1:9222 node scripts/verify-session-api.mjs
```

若无法连接服务，脚本会跳过并以退出码 0 结束。

## 架构说明

- 会话状态保存在 **单进程内存** 中；多副本部署时需自行引入粘性会话或共享存储等方案。
- 未在 HTTP 层强制 API Key；若暴露公网，建议在反向代理或网关上加认证。

## 许可证

ISC（见 `package.json`）。
