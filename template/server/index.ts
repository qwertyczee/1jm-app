import { Hono } from "hono";

const app = new Hono().basePath("/api");

// Info endpoint - returns app metadata
app.get("/info", (c) => {
  return c.json({
    name: "{{NAME}}",
    version: "1.0.0",
    framework: "Hono + React",
    timestamp: Date.now(),
  });
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    uptime: process.uptime?.() || 0,
  });
});

// Hello endpoint
app.get("/hello", (c) => {
  return c.json({
    message: "Hello from Hono + Bun!",
    time: Date.now(),
  });
});

// Echo endpoint for testing
app.post("/echo", async (c) => {
  const body = await c.req.json();
  return c.json({ echoed: body });
});

export default app;
