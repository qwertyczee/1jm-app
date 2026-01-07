// src/create.ts
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, "template");

export async function create(projectName: string) {
  if (!projectName) {
    console.error("Please specify a project name: 1jm create <name>");
    process.exit(1);
  }

  const cwd = process.cwd();
  const projectRoot = join(cwd, projectName);

  console.log(`\n✨ Creating project "${projectName}"...`);

  // Copy template files recursively
  await copyTemplate(TEMPLATE_DIR, projectRoot, projectName);

  // Read and update package.json
  const pkgPath = join(projectRoot, "package.json");
  const pkgJson = JSON.parse(await readFile(pkgPath, "utf-8"));
  pkgJson.name = projectName;
  await writeFile(pkgPath, JSON.stringify(pkgJson, null, 2));

  console.log("📦 Installing dependencies...");
  try {
    await $`cd ${projectRoot} && bun install`;
  } catch (e) {
    console.log("⚠️  Dependencies installed with some warnings.");
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
