import { Hono } from "hono";
import db from "./db";

const app = new Hono().basePath("/api");

// Info endpoint - returns app metadata
app.get("/info", (c) => {
  return c.json({
    name: "{{NAME}}",
    version: "1.0.0",
    framework: "Hono + React",
    database: "Prisma",
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

// ============ User CRUD endpoints ============

// Get all users
app.get("/users", async (c) => {
  const users = await db.user.findMany({
    include: { posts: true },
  });
  return c.json(users);
});

// Get user by id
app.get("/users/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const user = await db.user.findUnique({
    where: { id },
    include: { posts: true },
  });
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  return c.json(user);
});

// Create user
app.post("/users", async (c) => {
  const body = await c.req.json();
  const user = await db.user.create({
    data: {
      email: body.email,
      name: body.name,
    },
  });
  return c.json(user, 201);
});

// Update user
app.put("/users/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const user = await db.user.update({
    where: { id },
    data: {
      email: body.email,
      name: body.name,
    },
  });
  return c.json(user);
});

// Delete user
app.delete("/users/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  await db.user.delete({ where: { id } });
  return c.json({ success: true });
});

// ============ Post CRUD endpoints ============

// Get all posts
app.get("/posts", async (c) => {
  const posts = await db.post.findMany({
    include: { author: true },
  });
  return c.json(posts);
});

// Create post
app.post("/posts", async (c) => {
  const body = await c.req.json();
  const post = await db.post.create({
    data: {
      title: body.title,
      content: body.content,
      authorId: body.authorId,
    },
  });
  return c.json(post, 201);
});

export default app;
