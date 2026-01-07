import { Hono } from "hono";

const app = new Hono().basePath("/api");

app.get("/hello", (c) => {
  return c.json({
    message: "Hello from Hono + Bun!",
    time: Date.now(),
  });
});

export default app;
