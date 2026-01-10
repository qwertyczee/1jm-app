// src/create.ts
import { mkdir, writeFile, readFile, rm, copyFile } from "node:fs/promises";
import { readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type ProjectType = "fullstack-react-hono";
export type DatabaseType = "none" | "prisma" | "drizzle";

export interface CreateOptions {
  shouldOverrideExisting?: boolean;
  initGit?: boolean;
  projectType?: ProjectType;
  tailwind?: boolean;
  shadcn?: boolean;
  database?: DatabaseType;
}

interface PackageJson {
  name?: string;
  version?: string;
  type?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
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

/**
 * Deep merge package.json files
 * Later sources override earlier ones for simple values
 * Objects like dependencies/scripts are merged
 */
function mergePackageJson(...sources: PackageJson[]): PackageJson {
  const result: PackageJson = {};

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (key === "dependencies" || key === "devDependencies" || key === "scripts") {
        // Merge these objects
        result[key] = {
          ...(result[key] as Record<string, string> || {}),
          ...(value as Record<string, string>),
        };
      } else {
        // Override simple values
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Read package.json from a template directory if it exists
 */
async function readPackageJson(templateDir: string): Promise<PackageJson | null> {
  const pkgPath = join(templateDir, "package.json");
  if (!existsSync(pkgPath)) {
    return null;
  }
  const content = await readFile(pkgPath, "utf-8");
  return JSON.parse(content);
}

export async function create(projectName: string, options: CreateOptions = {}) {
  const {
    shouldOverrideExisting = false,
    initGit = true,
    projectType = "fullstack-react-hono",
    tailwind = false,
    shadcn = false,
    database = "none",
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
  console.log(`   Database: ${database === "none" ? "None" : database.charAt(0).toUpperCase() + database.slice(1)}`);
  console.log();

  // Remove existing directory if override is requested
  if (existsSync(projectRoot) && shouldOverrideExisting) {
    console.log(`   Removing existing directory...`);
    await rm(projectRoot, { recursive: true, force: true });
  }

  // Collect all template directories to apply
  const templateDirs: string[] = [];

  // Step 1: Base template is always included
  templateDirs.push(join(templatesRoot, "base"));

  // Step 2: Add styling template
  if (shadcn && tailwind) {
    templateDirs.push(join(templatesRoot, "shadcn"));
  } else if (tailwind) {
    templateDirs.push(join(templatesRoot, "tailwind"));
  }

  // Step 3: Add database template
  if (database === "prisma") {
    templateDirs.push(join(templatesRoot, "prisma"));
  } else if (database === "drizzle") {
    templateDirs.push(join(templatesRoot, "prisma"));
  }

  // Copy all templates (excluding package.json which we'll merge)
  for (const templateDir of templateDirs) {
    await copyTemplate(templateDir, projectRoot, projectName, { skipPackageJson: true });
  }

  // Merge all package.json files
  const packageJsons: PackageJson[] = [];
  for (const templateDir of templateDirs) {
    const pkg = await readPackageJson(templateDir);
    if (pkg) {
      packageJsons.push(pkg);
    }
  }

  // Merge and write the final package.json
  const mergedPackageJson = mergePackageJson(...packageJsons);
  // Replace {{NAME}} placeholder
  mergedPackageJson.name = projectName;
  
  await writeFile(
    join(projectRoot, "package.json"),
    JSON.stringify(mergedPackageJson, null, 2) + "\n"
  );

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
  if (database === "prisma" || database === "drizzle") {
    console.log(`  bun run db:push        # Push schema to database`);
  }
  console.log(`  bun run dev\n`);
}

interface CopyOptions {
  skipPackageJson?: boolean;
}

async function copyTemplate(
  src: string,
  dest: string,
  projectName: string,
  options: CopyOptions = {}
) {
  const { skipPackageJson = false } = options;
  
  await mkdir(dest, { recursive: true });

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    // Skip package.json if we're merging them separately
    if (skipPackageJson && entry.name === "package.json") {
      continue;
    }

    const srcPath = join(src, entry.name);
    const destName = entry.name.replace("{{NAME}}", projectName);
    const destPath = join(dest, destName);

    if (entry.isDirectory()) {
      await copyTemplate(srcPath, destPath, projectName, options);
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
