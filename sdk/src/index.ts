export type CloudBrowserClientOptions = {
  /** API 根地址，例如 `http://127.0.0.1:9222`（不要以 `/` 结尾） */
  baseUrl: string;
  /** 自定义 fetch（默认使用全局 `fetch`） */
  fetch?: typeof fetch;
  /** 每次请求附加的 HTTP 头（如网关鉴权） */
  headers?: Record<string, string>;
};

export type SessionStatusResponse = {
  sessionCount: number;
};

export type CreateSessionRequest = {
  sessionId: string;
  args?: string[];
};

export type CreateSessionResponse = {
  sessionId: string;
  ticket: string;
  wsEndpoint: string;
  expiresAt: number;
  /** 若服务端将来返回调试端口，会出现在此字段 */
  cdpPort?: number;
};

export type RenewSessionResponse = {
  expiresAt: number;
};

export type CloseSessionResponse = {
  closed: true;
};

export type ProfileInfo = {
  id: string;
  active: boolean;
  expiresAt: number | null;
};

export type UnlockProfileResponse = {
  id: string;
  removed: string[];
};

export type ApiErrorBody = {
  error?: string;
};

export class CloudBrowserApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined, message?: string) {
    super(message ?? code ?? `HTTP ${status}`);
    this.name = "CloudBrowserApiError";
    this.status = status;
    this.code = code;
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function getErrorCode(body: unknown): string | undefined {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as ApiErrorBody).error;
    return typeof e === "string" ? e : undefined;
  }
  return undefined;
}

export class CloudBrowserClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly extraHeaders: Record<string, string>;

  constructor(options: CloudBrowserClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl.trim());
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.extraHeaders = { ...options.headers };
  }

  /** `GET /health` */
  async getHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>("/health", { method: "GET" });
  }

  private async request<T>(
    path: string,
    init: RequestInit & { method: string; jsonBody?: unknown }
  ): Promise<T> {
    const { jsonBody, headers: hdrs, ...rest } = init;
    const headers = new Headers(hdrs);
    for (const [k, v] of Object.entries(this.extraHeaders)) {
      headers.set(k, v);
    }
    let body: string | undefined;
    if (jsonBody !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(jsonBody);
    }
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...rest,
      method: init.method,
      headers,
      body,
    });
    const parsed = await readJson(res);
    if (!res.ok) {
      throw new CloudBrowserApiError(
        res.status,
        getErrorCode(parsed),
        typeof parsed === "object" &&
          parsed !== null &&
          "error" in parsed &&
          typeof (parsed as ApiErrorBody).error === "string"
          ? (parsed as ApiErrorBody).error
          : undefined
      );
    }
    return parsed as T;
  }

  /** `GET /browser/status` */
  async getStatus(): Promise<SessionStatusResponse> {
    return this.request<SessionStatusResponse>("/browser/status", {
      method: "GET",
    });
  }

  /** `POST /browser/session` */
  async createSession(
    body: CreateSessionRequest
  ): Promise<CreateSessionResponse> {
    return this.request<CreateSessionResponse>("/browser/session", {
      method: "POST",
      jsonBody: body,
    });
  }

  /** `POST /browser/session/:id/renew` */
  async renewSession(
    sessionId: string,
    ticket?: string
  ): Promise<RenewSessionResponse> {
    const id = encodeURIComponent(sessionId);
    return this.request<RenewSessionResponse>(
      `/browser/session/${id}/renew`,
      {
        method: "POST",
        jsonBody: ticket ? { ticket } : {},
      }
    );
  }

  /** `POST /browser/session/:id/close` */
  async closeSession(
    sessionId: string,
    ticket?: string
  ): Promise<CloseSessionResponse> {
    const id = encodeURIComponent(sessionId);
    return this.request<CloseSessionResponse>(
      `/browser/session/${id}/close`,
      {
        method: "POST",
        jsonBody: ticket ? { ticket } : {},
      }
    );
  }

  /** `GET /browser/profiles` */
  async getProfiles(): Promise<ProfileInfo[]> {
    return this.request<ProfileInfo[]>("/browser/profiles", {
      method: "GET",
    });
  }

  /** `POST /browser/profile/:id/unlock` */
  async unlockProfile(profileId: string): Promise<UnlockProfileResponse> {
    const id = encodeURIComponent(profileId);
    return this.request<UnlockProfileResponse>(`/browser/profile/${id}/unlock`, {
      method: "POST",
    });
  }
}

/**
 * 在 `expiresAt` 前周期性调用 `renew`，避免会话因 30 秒无续期而关闭。
 * `initialExpiresAt` 通常取 `createSession` 返回的 `expiresAt`。
 * 返回 `stop()` 以清除定时器（应在 `closeSession` 或放弃会话时调用）。
 */
export function startSessionKeepAlive(
  client: CloudBrowserClient,
  sessionId: string,
  ticket: string,
  initialExpiresAt: number,
  options?: {
    /** 距 `expiresAt` 多少毫秒前触发续期，默认 10000 */
    renewBeforeMs?: number;
    /** 最小轮询间隔（毫秒），默认 5000 */
    minIntervalMs?: number;
  }
): { stop: () => void } {
  const renewBeforeMs = options?.renewBeforeMs ?? 10_000;
  const minIntervalMs = options?.minIntervalMs ?? 5_000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let lastExpiresAt = initialExpiresAt;

  const schedule = (expiresAt: number) => {
    if (stopped) return;
    lastExpiresAt = expiresAt;
    const delay = Math.max(
      minIntervalMs,
      expiresAt - Date.now() - renewBeforeMs
    );
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void (async () => {
        try {
          const { expiresAt: next } = await client.renewSession(
            sessionId,
            ticket
          );
          schedule(next);
        } catch {
          if (!stopped) {
            schedule(Math.max(lastExpiresAt, Date.now() + minIntervalMs));
          }
        }
      })();
    }, delay);
  };

  schedule(initialExpiresAt);

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
