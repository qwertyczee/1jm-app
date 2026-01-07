// src/start.ts
import { existsSync } from "node:fs";
import { join } from "node:path";

export async function start() {
  const CWD = process.cwd();
  const publicDir = join(CWD, "dist/public");
  const indexPath = join(publicDir, "index.html");
  const distServerPath = join(CWD, "dist/server/index.js");

  if (!existsSync(indexPath) || !existsSync(distServerPath)) {
    console.log("❌ App not built. Run 'bunx 1jm build' first.");
    process.exit(1);
  }

  const serverModule = await import(distServerPath);
  const apiFetch = serverModule.default?.fetch || serverModule.fetch;

  if (typeof apiFetch !== "function") {
    console.log("❌ dist/server/index.js does not export a fetch function.");
    process.exit(1);
  }

  console.log("🚀 Starting production server...\n");

  Bun.serve({
    port: 3000,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname.startsWith("/api/")) {
        return apiFetch(req);
      }

      const filePath = join(publicDir, url.pathname);
      const file = Bun.file(filePath);

      if (await file.exists()) {
        const isDirectory = (await file.stat()).isDirectory();
        if (!isDirectory) {
          return new Response(file);
        }
      }

      return new Response(Bun.file(indexPath));
    },
  });

  console.log("✅ Server ready at http://localhost:3000");
}