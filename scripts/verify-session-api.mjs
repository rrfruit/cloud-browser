#!/usr/bin/env node
import { randomUUID } from "node:crypto";

/**
 * Integration checks against a running API (needs Chrome / PUPPETEER_EXECUTABLE_PATH).
 * Usage: BASE_URL=http://127.0.0.1:3000 node scripts/verify-session-api.mjs
 * If the server is unreachable, exits 0 with a skip message.
 */

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const prefix = `${BASE.replace(/\/$/, "")}/browser`;

async function main() {
  try {
    const probe = await fetch(`${prefix}/status`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!probe.ok) {
      throw new Error(`GET /browser/status -> ${probe.status}`);
    }
  } catch (e) {
    console.log(
      "verify-session-api: skipped (server unreachable). Start the service and set BASE_URL if needed."
    );
    console.log(String(/** @type {Error} */ (e).message ?? e));
    process.exit(0);
  }

  const badId = await fetch(`${prefix}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: "bad/id" }),
  });
  if (badId.status !== 400) {
    throw new Error(`invalid sessionId expected 400, got ${badId.status}`);
  }

  const clientSessionId = randomUUID();
  const create = await fetch(`${prefix}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: clientSessionId }),
  });
  if (create.status !== 201) {
    throw new Error(`POST /sessions expected 201, got ${create.status}`);
  }
  const session = await create.json();
  const { sessionId, ticket, wsEndpoint, expiresAt } = session;
  if (sessionId !== clientSessionId) {
    throw new Error(`expected sessionId ${clientSessionId}, got ${sessionId}`);
  }
  if (!sessionId || !ticket || !wsEndpoint || typeof expiresAt !== "number") {
    throw new Error(`unexpected create payload: ${JSON.stringify(session)}`);
  }

  const dup = await fetch(`${prefix}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: clientSessionId }),
  });
  if (dup.status !== 409) {
    throw new Error(`duplicate sessionId expected 409, got ${dup.status}`);
  }

  const badRenew = await fetch(`${prefix}/sessions/${sessionId}/renew`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket: "0".repeat(64) }),
  });
  if (badRenew.status !== 401) {
    throw new Error(`wrong ticket renew expected 401, got ${badRenew.status}`);
  }

  const goodRenew = await fetch(`${prefix}/sessions/${sessionId}/renew`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket }),
  });
  if (goodRenew.status !== 200) {
    throw new Error(`renew expected 200, got ${goodRenew.status}`);
  }
  const renewed = await goodRenew.json();
  if (typeof renewed.expiresAt !== "number") {
    throw new Error(`unexpected renew payload: ${JSON.stringify(renewed)}`);
  }

  const missing = await fetch(
    `${prefix}/sessions/00000000-0000-4000-8000-000000000000/renew`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: "0".repeat(64) }),
    }
  );
  if (missing.status !== 404) {
    throw new Error(`unknown session renew expected 404, got ${missing.status}`);
  }

  const closed = await fetch(`${prefix}/sessions/${sessionId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket }),
  });
  if (closed.status !== 200) {
    throw new Error(`close expected 200, got ${closed.status}`);
  }

  const reuse = await fetch(`${prefix}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: clientSessionId }),
  });
  if (reuse.status !== 201) {
    throw new Error(
      `reuse sessionId after close expected 201, got ${reuse.status}`
    );
  }
  const again = await reuse.json();
  await fetch(`${prefix}/sessions/${clientSessionId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket: again.ticket }),
  });

  console.log("verify-session-api: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
