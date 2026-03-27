# cloud-browser-sdk

面向 [cloud-browser](../README.md) HTTP API 的 TypeScript 客户端。仅依赖 **全局 `fetch`**（Node.js 18+ 或支持 Fetch 的运行时），无 Puppeteer 等浏览器依赖；拿到 `wsEndpoint` 后请自行用 `puppeteer.connect`、`chrome-remote-interface` 等连接 CDP。

## 安装

在 monorepo 或本地路径安装：

```bash
npm install /path/to/cloud-browser/sdk
```

在 `sdk` 目录首次安装依赖时，`prepare` 脚本会执行 `tsc` 生成 `dist/`。也可在仓库根目录执行：

```bash
npm run build:sdk
```

## 快速开始

```typescript
import puppeteer from "puppeteer-core";
import {
  CloudBrowserClient,
  CloudBrowserApiError,
  startSessionKeepAlive,
} from "cloud-browser-sdk";

const client = new CloudBrowserClient({
  baseUrl: process.env.CLOUD_BROWSER_URL ?? "http://127.0.0.1:9222",
});

const { sessionId, ticket, wsEndpoint, expiresAt } =
  await client.createSession({ sessionId: "my-job-1" });

const keepAlive = startSessionKeepAlive(
  client,
  sessionId,
  ticket,
  expiresAt
);

try {
  const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
  // …
  await browser.disconnect();
} finally {
  keepAlive.stop();
  await client.closeSession(sessionId, ticket);
}
```

## `CloudBrowserClient` 构造选项

| 选项 | 类型 | 说明 |
|------|------|------|
| `baseUrl` | `string` | API 根地址，如 `http://127.0.0.1:9222`；末尾 `/` 会自动去掉 |
| `fetch` | `typeof fetch` | 可选，用于测试或自定义 HTTP 实现 |
| `headers` | `Record<string, string>` | 可选，每个请求都会合并进去（例如网关 `Authorization`） |

## API 方法

| 方法 | HTTP | 返回类型 |
|------|------|----------|
| `getHealth()` | `GET /health` | `{ status: string }` |
| `getStatus()` | `GET /browser/status` | `{ sessionCount: number }` |
| `createSession(body)` | `POST /browser/session` | 见下方 |
| `renewSession(sessionId, ticket)` | `POST /browser/session/:id/renew` | `{ expiresAt: number }` |
| `closeSession(sessionId, ticket)` | `POST /browser/session/:id/close` | `{ closed: true }` |

### `createSession(body)`

- `body.sessionId`（必填）：与服务端规则一致，trim 后长度 1～128，字符集 `[\w.-]`。
- `body.args`（可选）：追加传给 Chromium 的命令行参数。

成功时返回：

- `sessionId`、`ticket`、`wsEndpoint`、`expiresAt`（Unix 毫秒时间戳）
- `cdpPort`（可选）：若未来服务端在 JSON 中返回，类型中已预留

### `sessionId` 与 URL

`renewSession` / `closeSession` 中的 `sessionId` 会经 `encodeURIComponent` 再放入路径，一般无需自行编码。

## 错误处理

非 2xx 响应会抛出 **`CloudBrowserApiError`**（`Error` 子类）：

- `status`：HTTP 状态码
- `code`：响应体里 `error` 字段的字符串，例如 `INVALID_SESSION_ID`、`SESSION_ID_IN_USE`、`NOT_FOUND`、`UNAUTHORIZED`
- `message`：优先为 `error` 文本，否则为 `HTTP <status>`

```typescript
import { CloudBrowserApiError } from "cloud-browser-sdk";

try {
  await client.createSession({ sessionId: "bad id!" });
} catch (e) {
  if (e instanceof CloudBrowserApiError) {
    console.error(e.status, e.code);
  }
  throw e;
}
```

## `startSessionKeepAlive`

服务端会话为 **30 秒滑动续期**：自上次创建或成功续期起，若 30 秒内没有再次续期，浏览器会被关闭。

`startSessionKeepAlive(client, sessionId, ticket, initialExpiresAt, options?)` 会在每次 `expiresAt` 之前自动调用 `renewSession`。`initialExpiresAt` 应使用 **`createSession` 返回的 `expiresAt`**。

| 选项 | 默认 | 说明 |
|------|------|------|
| `renewBeforeMs` | `10000` | 在过期前多少毫秒触发续期 |
| `minIntervalMs` | `5000` | 两次调度之间的最小间隔（毫秒） |

返回值：`{ stop: () => void }`。在 `closeSession` 结束会话或不再使用该会话时，务必调用 **`stop()`**，避免泄漏定时器。

## 类型导出

包内同时导出请求/响应类型，便于上层封装：`CloudBrowserClientOptions`、`SessionStatusResponse`、`CreateSessionRequest`、`CreateSessionResponse`、`RenewSessionResponse`、`CloseSessionResponse`、`ApiErrorBody` 等（见源码 `src/index.ts`）。

## 完整 HTTP 语义

与路由、状态码、错误码的权威说明见仓库根目录 [README.md § HTTP API](../README.md#http-api)。

## 许可证

ISC（与主项目一致）。
