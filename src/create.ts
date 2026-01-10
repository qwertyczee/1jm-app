// src/create.ts
import { mkdir, writeFile, readFile, rm, copyFile } from "node:fs/promises";
import { readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type ProjectType = "fullstack-react-hono";

export interface CreateOptions {
  shouldOverrideExisting?: boolean;
  initGit?: boolean;
  projectType?: ProjectType;
  tailwind?: boolean;
  shadcn?: boolean;
}

const getTemplatesRoot = () => {
  const paths = [
    resolve(__dirname, "..", "templates"),
    resolve(__dirname, "..", "..", "templates"),
  ];

  for (const p of paths) {
    if (existsSync(p) && readdirSync(p).length > 0) {
      return p;
    }
  }
  throw new Error("Templates directory not found");
};

export async function create(projectName: string, options: CreateOptions = {}) {
  const {
    shouldOverrideExisting = false,
    initGit = true,
    projectType = "fullstack-react-hono",
    tailwind = false,
    shadcn = false,
  } = options;

  if (!projectName) {
    console.error("Please specify a project name: 1jm create <name>");
    process.exit(1);
  }

  const cwd = process.cwd();
  const projectRoot = join(cwd, projectName);
  const templatesRoot = getTemplatesRoot();

  console.log(`\n Creating project "${projectName}"...`);

  // Show selected options
  console.log(`\n   Project type: FullStack React + Hono`);
  console.log(`   Tailwind CSS: ${tailwind ? "Yes" : "No"}`);
  if (tailwind) {
    console.log(`   shadcn/ui: ${shadcn ? "Yes" : "No"}`);
  }
  console.log();

  // Remove existing directory if override is requested
  if (existsSync(projectRoot) && shouldOverrideExisting) {
    console.log(`   Removing existing directory...`);
    await rm(projectRoot, { recursive: true, force: true });
  }

  // Step 1: Copy base template
  const baseTemplateDir = join(templatesRoot, "base");
  await copyTemplate(baseTemplateDir, projectRoot, projectName);

  // Step 2: If shadcn is selected, overlay shadcn template (includes tailwind)
  if (shadcn && tailwind) {
    const shadcnTemplateDir = join(templatesRoot, "shadcn");
    await copyTemplate(shadcnTemplateDir, projectRoot, projectName);
  }
  // Step 3: Else if only tailwind is selected, overlay tailwind template
  else if (tailwind) {
    const tailwindTemplateDir = join(templatesRoot, "tailwind");
    await copyTemplate(tailwindTemplateDir, projectRoot, projectName);
  }

  console.log("   Installing dependencies...");
  try {
    await $`cd ${projectRoot} && bun install`.quiet();
  } catch (e) {
    console.log("   Dependencies installed with some warnings.");
  }

  // Initialize git if requested
  if (initGit) {
    console.log("   Initializing git repository...");
    try {
      await $`cd ${projectRoot} && git init`.quiet();
      await $`cd ${projectRoot} && git add .`.quiet();
      await $`cd ${projectRoot} && git commit -m "Initial commit"`.quiet();
    } catch (e) {
      console.log("   Git initialization failed.");
    }
  }

  console.log(`\n Project created successfully!`);
  console.log(`\nNext steps:`);
  console.log(`  cd ${projectName}`);
  console.log(`  bun run dev\n`);
}

async function copyTemplate(src: string, dest: string, projectName: string) {
  await mkdir(dest, { recursive: true });

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destName = entry.name.replace("{{NAME}}", projectName);
    const destPath = join(dest, destName);

    if (entry.isDirectory()) {
      await copyTemplate(srcPath, destPath, projectName);
    } else {
      // Check if it's a binary file (images, etc.) or text file
      const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
      const isBinary = binaryExtensions.some(ext => entry.name.toLowerCase().endsWith(ext));
      
      if (isBinary) {
        await copyFile(srcPath, destPath);
      } else {
        let content = await readFile(srcPath, "utf-8");
        content = content.replace(/\{\{NAME\}\}/g, projectName);
        await writeFile(destPath, content);
      }
    }
  }
}
