// src/create.ts
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const __dirname = dirname(fileURLToPath(import.meta.url));

const getTemplateDir = () => {
  const paths = [
    resolve(__dirname, "..", "template"),
    resolve(__dirname, "..", "..", "template"),
    join(__dirname, "template"),
  ];

  for (const p of paths) {
    if (existsSync(p) && readdirSync(p).length > 0) {
      return p;
    }
  }
  throw new Error("Template directory not found");
};

const TEMPLATE_DIR = getTemplateDir();

export async function create(projectName: string, options: { shouldOverrideExisting?: boolean; initGit?: boolean } = {}) {
  const { shouldOverrideExisting = false, initGit = true } = options;

  if (!projectName) {
    console.error("Please specify a project name: 1jm create <name>");
    process.exit(1);
  }

  const cwd = process.cwd();
  const projectRoot = join(cwd, projectName);

  console.log(`\n✨ Creating project "${projectName}"...`);

  // Remove existing directory if override is requested
  if (existsSync(projectRoot) && shouldOverrideExisting) {
    console.log(`🗑️  Removing existing directory...`);
    await rm(projectRoot, { recursive: true, force: true });
  }

  // Copy template files recursively
  await copyTemplate(TEMPLATE_DIR, projectRoot, projectName);

  // Read and update package.json
  const pkgPath = join(projectRoot, "package.json");
  const pkgJson = JSON.parse(await readFile(pkgPath, "utf-8"));
  pkgJson.name = projectName;
  await writeFile(pkgPath, JSON.stringify(pkgJson, null, 2));

  console.log("📦 Installing dependencies...");
  try {
    await $`cd ${projectRoot} && bun install`.quiet();
  } catch (e) {
    console.log("⚠️  Dependencies installed with some warnings.");
  }

  // Initialize git if requested
  if (initGit) {
    console.log("🔗 Initializing git repository...");
    try {
      await $`cd ${projectRoot} && git init`.quiet();
      await $`cd ${projectRoot} && git add .`.quiet();
      await $`cd ${projectRoot} && git commit -m "Initial commit"`.quiet();
    } catch (e) {
      console.log("⚠️  Git initialization failed.");
    }
  }

  console.log(`\n✅ Project created!`);
  console.log(`\ncd ${projectName}`);
  console.log(`bun run dev\n`);
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
      let content = await readFile(srcPath, "utf-8");
      content = content.replace(/\{\{NAME\}\}/g, projectName);
      await writeFile(destPath, content);
    }
  }
}
