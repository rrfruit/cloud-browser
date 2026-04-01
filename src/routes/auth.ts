import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";

export const adminAuthRoute = new Hono()
  /** 管理员登录 */
  .post("/login", sValidator("json", z.object({ username: z.string(), password: z.string() })), async (c) => {
    const data = c.req.valid("json");

    if (data.username !== "admin" || data.password !== "admin") {
      throw new Error("Invalid username or password");
    }
    return c.json({
      accessToken: 'token',
      tokenType: "Bearer",
    });
  })
  /** 获取管理员信息 */
  .get("/profile", async (c) => {
    return c.json({
      id: 1,
      username: "admin",
    });
  })
