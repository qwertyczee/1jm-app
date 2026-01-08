#!/usr/bin/env bun
// bin/cli.ts
import { create } from "../src/create.js";
import { build } from "../src/build.js";
import { dev } from "../src/dev.js";
import { start } from "../src/start.js";
import { analyzeRoutes } from "../src/analyze.js";
import prompts from "prompts";
import { existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const command = args[0];
const flags = new Set(args.slice(1));

async function getProjectName(): Promise<string> {
  const inputName = args[1];

  // If user passed a name as argument, use it
  if (inputName) {
    // If it's ".", use "app" as default name
    return inputName === "." ? "app" : inputName;
  }

  // Interactive prompt
  const response = await prompts({
    type: "text",
    name: "projectName",
    message: "What is the project name?",
    initial: "app",
    validate: (value: string) => {
      if (!value || value.trim() === "") {
        return "Project name cannot be empty";
      }
      return true;
    },
  });

  return response.projectName || "app";
}

async function shouldOverride(targetDir: string): Promise<boolean> {
  const response = await prompts({
    type: "confirm",
    name: "override",
    message: `Directory "${targetDir}" already exists. Override?`,
    initial: false,
  });
  return response.override;
}

async function shouldInitGit(): Promise<boolean> {
  const response = await prompts({
    type: "confirm",
    name: "git",
    message: "Initialize git repository?",
    initial: true,
  });
  return response.git;
}

async function main() {
  switch (command) {
    case "create": {
      const projectName = await getProjectName();
      const cwd = process.cwd();
      const projectRoot = join(cwd, projectName);

      // Check if directory exists
      let shouldProceed = false;
      if (existsSync(projectRoot)) {
        shouldProceed = await shouldOverride(projectName);
        if (!shouldProceed) {
          console.log("Aborted.");
          process.exit(0);
        }
      }

      // Ask to initialize git
      const initGit = await shouldInitGit();

      await create(projectName, { shouldOverrideExisting: shouldProceed, initGit });
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
    case "analyze": {
      console.log("🔍 Scanning routes in server/index.ts...");
      const results = analyzeRoutes(process.cwd());
      
      if (results.length === 0) {
        console.log("No routes found or server/index.ts missing.");
      } else {
        console.table(results);
      }
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
  1jm analyze           Analyze static vs dynamic routes - experimental
  1jm start             Start production server

Examples:
  1jm create my-app
  cd my-app && bun run dev
      `);
  }
}

main().catch(console.error);
