// src/build.ts
import { rm, mkdir } from "node:fs/promises";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { analyzeRoutes } from "./analyze.js";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function printFiles(dir: string, filterHidden = true) {
  if (!existsSync(dir)) return [];

  const entries = readdirSync(dir, { withFileTypes: true });
  const files: { name: string; size: string }[] = [];

  for (const entry of entries) {
    if (filterHidden && entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      const subFiles = printFiles(join(dir, entry.name), filterHidden);
      files.push(...subFiles);
    } else {
      const size = statSync(join(dir, entry.name)).size;
      files.push({ name: entry.name, size: formatSize(size) });
    }
  }
  return files;
}

export async function build({
  isVercel: isVercelArg,
  static: isStaticArg,
}: {
  isVercel?: boolean;
  static?: boolean;
}) {
  const isVercel = isVercelArg || !!process.env.VERCEL;
  const CWD = process.cwd();

  const BASE_OUT = isVercel ? join(CWD, ".vercel/output") : join(CWD, "dist");

  const FUNC_DIR = isVercel
    ? join(BASE_OUT, "functions/api.func")
    : join(BASE_OUT, "server");

  const STATIC_DIR = isVercel
    ? join(BASE_OUT, "static")
    : join(BASE_OUT, "public");

  const CLIENT_ENTRY = join(CWD, "client/index.html");
  const SERVER_ENTRY = join(CWD, "server/index.ts");

  console.log(`\nBuilding for ${isVercel ? "Vercel" : "Production"}...`);
  if (isVercel && isStaticArg) {
    console.log("⚡ Static Optimization Enabled");
  }

  await rm(BASE_OUT, { recursive: true, force: true });
  await mkdir(FUNC_DIR, { recursive: true });
  await mkdir(STATIC_DIR, { recursive: true });

  if (!existsSync(CLIENT_ENTRY)) {
    throw new Error(`Client entry not found: ${CLIENT_ENTRY}`);
  }

  const clientBuild = await Bun.build({
    entrypoints: [CLIENT_ENTRY],
    outdir: STATIC_DIR,
    target: "browser",
    minify: true,
    packages: "bundle",
    sourcemap: "none",
  });

  if (!clientBuild.success) {
    console.error(clientBuild.logs);
    process.exit(1);
  }

  const staticFiles = printFiles(STATIC_DIR);

  await Bun.build({
    entrypoints: [SERVER_ENTRY],
    outdir: FUNC_DIR,
    target: "bun",
    minify: true,
    naming: "index.js",
  });

  const serverFiles = printFiles(FUNC_DIR).filter(
    (f) => !f.name.includes(".vc-config") && !f.name.includes("package.json")
  );

  const allFiles = [...staticFiles, ...serverFiles];
  const maxNameLen =
    allFiles.length > 0
      ? Math.max(...allFiles.map((f) => f.name.length))
      : 20;

  console.log("\nClient:");
  for (const file of staticFiles) {
    const paddedName = file.name.padEnd(maxNameLen);
    console.log(`  ${paddedName}  ${file.size}`);
  }

  console.log("\nServer:");
  for (const file of serverFiles) {
    const paddedName = file.name.padEnd(maxNameLen);
    console.log(`  ${paddedName}  ${file.size}`);
  }

  if (isVercel) {
    // 1. Generate Function Config
    const funcConfig = {
      handler: "index.js",
      runtime: "bun1.x",
      architecture: "x86_64",
      environment: {},
      launcherType: "Bun",
      shouldAddHelpers: true,
      shouldAddSourcemapSupport: false,
      awsLambdaHandler: "",
    };
    await Bun.write(
      join(FUNC_DIR, ".vc-config.json"),
      JSON.stringify(funcConfig, null, 2)
    );

    // 2. Copy Package.json
    const userPkg = await Bun.file(join(CWD, "package.json")).text();
    await Bun.write(join(FUNC_DIR, "package.json"), userPkg);

    // 3. Generate Route Config (With Static Optimization)
    let staticCacheRoutes: any[] = [];

    if (isStaticArg) {
      console.log("\n🔍 Analyzing routes for caching...");
      try {
        const analyzed = analyzeRoutes(CWD);

        // Print Analysis Table
        console.table(
          analyzed.map((r) => ({
            Method: r.method,
            Path: '/api' + r.path,
            Type: r.type,
            Details:
              r.type === "STATIC"
                ? "✅ Cached (12h)"
                : `⚠️  ${r.reason || "Dynamic"}`,
          }))
        );

        const staticRoutes = analyzed.filter((r) => r.type === "STATIC");

        staticCacheRoutes = staticRoutes.map((route) => {
          // Normalize Path: / -> /api, /users -> /api/users
          const routePath = route.path === "/" ? "" : route.path;
          return {
            src: `^${routePath}$`,
            headers: {
              "cache-control":
                "public, max-age=0, s-maxage=43200, stale-while-revalidate=600",
            },
            continue: true,
          };
        });
      } catch (e) {
        console.error(
          "Warning: Route analysis failed, skipping static optimization.",
          e
        );
      }
    }

    const globalConfig = {
      version: 3,
      routes: [
        // 1. Static Cache Overrides (Apply headers then continue)
        ...staticCacheRoutes,

        // 2. API Function Routing
        { src: "/api/(.*)", dest: "/api" },

        // 3. Static Assets (Client)
        { handle: "filesystem" },

        // 4. SPA Fallback
        { src: "/(.*)", dest: "/index.html" },
      ],
    };

    await Bun.write(
      join(BASE_OUT, "config.json"),
      JSON.stringify(globalConfig, null, 2)
    );

    console.log("\n✅ Build Complete! Ready for Vercel deployment.");
  } else {
    console.log("\n✅ Build Complete! Output in ./dist");
  }
}