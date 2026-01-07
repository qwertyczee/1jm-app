#!/usr/bin/env bun
// bin/cli.ts
import { start, build, create, dev } from "../src/index.js";

const args = process.argv.slice(2);
const command = args[0];
const flags = new Set(args.slice(1));

async function main() {
  switch (command) {
    case "create": {
      const projectName = args[1] || "app";
      await create(projectName);
      break;
    }
    case "build": {
      await build({
        isVercel: flags.has("--vercel"),
      });
      break;
    }
    case "dev": {
      await dev({
        client: flags.has("--client"),
        server: flags.has("--server"),
      });
      break;
    }
    case "start": {
      await start();
      break;
    }
    default:
      console.log(`
1jm - Full-stack framework with Hono + Vite React for vercel on bun runtime

Usage:
  1jm create <name>     Create a new project
  1jm build             Build for production
  1jm build --vercel    Build for Vercel deployment
  1jm dev               Start development server
  1jm dev --client      Start client development server
  1jm dev --server      Start backend development server
  1jm start             Start production server

Examples:
  1jm create my-app
  cd my-app && bun run dev
      `);
  }
}

main().catch(console.error);
