import type { AppType } from "../../../src/app";
import { hc } from "hono/client";
import router from "../router";

async function api(input: RequestInfo | URL, requestInit?: RequestInit) {
  return fetch(input, requestInit).then(async (res) => {
    if (res.status === 401) {
      router.replace("/login");
    }
    if (!res.ok) {
      const errorMessages = await res.clone().text();
      ElMessage.error(errorMessages || "请求失败");
    }
    return res;
  });
}

const client = hc<AppType>(import.meta.env.VITE_API_BASE_URL, {
  headers() {
    return {
      authorization: `Bearer ${localStorage.getItem("token-admin") || ""}`,
    };
  },
  fetch: api,
});

export { client };
