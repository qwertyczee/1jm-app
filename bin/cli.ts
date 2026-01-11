#!/usr/bin/env bun
// bin/cli.ts
import { create, type DatabaseType } from "../src/create.js";
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

async function selectDatabase(): Promise<DatabaseType> {
  const response = await prompts({
    type: "select",
    name: "database",
    message: "Select database:",
    choices: [
      { title: "None", value: "none" },
      { title: "Prisma", value: "prisma" },
      { title: "Drizzle - comming soon, (this is still prisma)", value: "drizzle" },
    ],
    initial: 0,
  });
  return response.database || "none";
}

async function selectStyling(): Promise<{ tailwind: boolean; shadcn: boolean }> {
  const tailwindResponse = await prompts({
    type: "confirm",
    name: "tailwind",
    message: "Add Tailwind CSS?",
    initial: true,
  });

  let shadcn = false;
  if (tailwindResponse.tailwind) {
    const shadcnResponse = await prompts({
      type: "confirm",
      name: "shadcn",
      message: "Add shadcn/ui?",
      initial: true,
    });
    shadcn = shadcnResponse.shadcn;
  }

  return { tailwind: tailwindResponse.tailwind, shadcn };
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

      // Ask about styling
      const { tailwind, shadcn } = await selectStyling();

      // Ask about database
      const database = await selectDatabase();

      // Ask to initialize git
      const initGit = await shouldInitGit();

      await create(projectName, { shouldOverrideExisting: shouldProceed, initGit, database, tailwind, shadcn });
      break;
    }
    case "build": {
      await build({
        isVercel: flags.has("--vercel"),
        isCloudflare: flags.has("--cloudflare"),
        static: flags.has("--experimental-static")
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
1jm - Full-stack framework with Hono + Vite React

Usage:
  1jm create <name>                         Create a new project
  1jm build                                 Build for production
  1jm build --cloudflare                    Build for Cloudflare Workers
  1jm build --vercel                        Build for Vercel deployment
  1jm build --vercel --experimental-static  Build for Vercel with cached static endpoints   - experimental
  1jm analyze                               Analyze static vs dynamic routes                - experimental
  1jm dev                                   Start development server
  1jm dev --client                          Start client development server
  1jm dev --server                          Start backend development server
  1jm start                                 Start production server

Examples:
  1jm create my-app
  cd my-app && bun run dev
      `);
  }
}

main().catch(console.error);
