import { createServer } from "vite";
import { join, resolve } from "node:path";
import { watch } from "node:fs";

const S = "\x1b[35m[SERVER]\x1b[0m";
const C = "\x1b[36m[CLIENT]\x1b[0m";

async function isPortInUse(port: number): Promise<boolean> {
  try {
    const socket = await Bun.connect({
      hostname: "127.0.0.1",
      port,
      socket: {
        data() {},
        error() {},
      },
    });
    socket.end();
    return true;
  } catch {
    return false;
  }
}

export async function dev({
  client = false,
  server = false,
}: {
  client?: boolean;
  server?: boolean;
} = {}) {
  const startBoth = !client && !server;
  const useClient = startBoth || client;
  const useServer = startBoth || server;
  const CWD = process.cwd();

  const SERVER_PORT = 45828;
  const CLIENT_PORT = 3000;

  console.log(`🚀 Starting development environment on http://localhost:${CLIENT_PORT}\n`);

  if (useServer) {
    if (!(await isPortInUse(SERVER_PORT))) {
      const serverPath = resolve(CWD, "server/index.ts");
      let serverModule = await import(serverPath);
      let apiFetch = serverModule.default?.fetch || serverModule.fetch;

      Bun.serve({
        port: SERVER_PORT,
        fetch: (req) => apiFetch(req),
      });

      let debounceTimer: Timer | null = null;
      watch(
        join(CWD, "server"),
        { recursive: true },
        (event, filename) => {
          if (!filename) return;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            try {
              const module = await import(`${serverPath}?update=${Date.now()}`);
              apiFetch = module.default?.fetch || module.fetch;
              console.log(`${S} reloaded: ${filename}`);
            } catch (e) {
              console.error(`${S} reload failed: ${e}`);
            }
          }, 50);
        }
      );
    } else {
      console.log(`${S} already running on ${SERVER_PORT}`);
    }
  }

  if (useClient) {
    if (!(await isPortInUse(CLIENT_PORT))) {
      const vite = await createServer({
        root: resolve(CWD, "client"),
        server: {
          port: CLIENT_PORT,
          strictPort: true,
          proxy: {
            "/api": `http://localhost:${SERVER_PORT}`,
          },
        },
        logLevel: "silent",
      });

      await vite.listen();

      vite.watcher.on("change", (file) => {
        console.log(`${C} updated: ${file.split(/[\\/]/).pop()}`);
      });
    } else {
      console.log(`${C} already running on ${CLIENT_PORT}`);
    }
  }
}