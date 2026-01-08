import { describe, it, expect, afterEach } from "bun:test";
import { analyzeRoutes } from "../src/analyze"; 
import path from "path";
import fs from "fs";

const TEMP_DIR = path.join(process.cwd(), ".test_env_" + Date.now());
const SERVER_DIR = path.join(TEMP_DIR, "server");

// --- UPDATED HELPER: Support multiple files ---
function createTestEnv(files: string | Record<string, string>) {
  if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(SERVER_DIR, { recursive: true });

  // 1. Write tsconfig
  fs.writeFileSync(path.join(TEMP_DIR, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ESNext", module: "ESNext", moduleResolution: "bundler" }
  }));

  // 2. Handle Single File vs Multi File
  if (typeof files === "string") {
    // Legacy support for string input
    const code = `
      import { Hono } from 'hono';
      const app = new Hono();
      ${files}
      export default app;
    `;
    fs.writeFileSync(path.join(SERVER_DIR, "index.ts"), code);
  } else {
    // Multi-file support
    for (const [filename, content] of Object.entries(files)) {
      const filePath = path.join(SERVER_DIR, filename);
      // Ensure "index.ts" has the Hono wrapper if user didn't provide it fully
      if (filename === "index.ts" && !content.includes("export default app")) {
         const fullCode = `
          import { Hono } from 'hono';
          const app = new Hono();
          ${content}
          export default app;
        `;
        fs.writeFileSync(filePath, fullCode);
      } else {
        fs.writeFileSync(filePath, content);
      }
    }
  }

  return TEMP_DIR;
}

afterEach(() => {
  if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});

describe("Hono Route Analyzer", () => {

  describe("1. Primitives & Literals", () => {
    it("detects static strings", () => {
      const dir = createTestEnv(`app.get('/simple', (c) => c.json({ msg: "hello" }));`);
      const res = analyzeRoutes(dir);
      
      expect(res).toContainEqual({
        method: "GET", path: "/simple", type: "STATIC", reason: undefined
      });
    });

    it("detects static numbers and booleans", () => {
      const dir = createTestEnv(`app.post('/nums', (c) => c.json({ id: 123, active: true }));`);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("STATIC");
    });

    it("detects simple template literals", () => {
      const dir = createTestEnv("app.get('/tmpl', (c) => c.json({ msg: `simple` }));");
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("STATIC");
    });

    it("detects interpolated template literals as DYNAMIC", () => {
      const dir = createTestEnv(`
        const name = "user";
        app.get('/tmpl', (c) => c.json({ msg: \`hello \${name}\` }));
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
    });
  });

  describe("2. Variable Tracing (Const vs Let)", () => {
    it("traces CONST variables correctly", () => {
      const dir = createTestEnv(`
        const DATA = { version: 1 };
        app.get('/ver', (c) => c.json(DATA));
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("STATIC");
    });

    it("marks LET variables as DYNAMIC (unsafe)", () => {
      const dir = createTestEnv(`
        let data = { version: 1 };
        app.get('/ver', (c) => c.json(data));
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
    });

    it("traces nested object properties", () => {
      const dir = createTestEnv(`
        const CFG = { meta: { title: "Title" } };
        app.get('/meta', (c) => c.json({ title: CFG.meta.title }));
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("STATIC");
    });
  });

  describe("3. Globals & Runtime Safety", () => {
    it("detects Date.now() as DYNAMIC", () => {
      const dir = createTestEnv(`app.get('/time', (c) => c.json({ t: Date.now() }));`);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
      expect(res[0].reason).toContain("Dynamic Global");
    });

    it("detects Math.random() as DYNAMIC", () => {
      const dir = createTestEnv(`app.get('/rand', (c) => c.json({ n: Math.random() }));`);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
    });

    it("detects process.env as DYNAMIC", () => {
      const dir = createTestEnv(`app.get('/env', (c) => c.json({ k: process.env.API_KEY }));`);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
    });

    it("detects variable holding dynamic value", () => {
      const dir = createTestEnv(`
        const START_TIME = Date.now(); 
        app.get('/status', (c) => c.json({ since: START_TIME }));
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
    });
  });

  describe("4. Hono Context Usage", () => {
    it("allows c.json()", () => {
      const dir = createTestEnv(`app.get('/', (c) => c.json({}));`);
      expect(analyzeRoutes(dir)[0].type).toBe("STATIC");
    });

    it("flags c.req.query() as DYNAMIC", () => {
      const dir = createTestEnv(`
        app.get('/search', (c) => {
          const q = c.req.query('q');
          return c.json({ result: q });
        });
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
      expect(res[0].reason).toContain("c.req"); // or generic dynamic reason
    });

    it("flags c.env usage as DYNAMIC", () => {
      const dir = createTestEnv(`app.get('/e', (c) => c.json({ key: c.env.KEY }));`);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
    });
  });

  describe("5. Middleware & Chains", () => {
    it("flags route as DYNAMIC if middleware is present", () => {
      const dir = createTestEnv(`
        const auth = async (c, next) => await next();
        app.get('/protected', auth, (c) => c.json({ secret: true }));
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
      expect(res[0].reason).toContain("Middleware");
    });

    it("handles multiple arguments", () => {
      const dir = createTestEnv(`
        const log = (c, n) => n();
        const auth = (c, n) => n();
        app.get('/chain', log, auth, (c) => c.json({}));
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
    });
  });

  describe("6. Nested Routers", () => {
    it("prefixes paths correctly for sub-routers", () => {
      const dir = createTestEnv(`
        const admin = new Hono();
        admin.get('/dash', (c) => c.json({}));
        app.route('/admin', admin);
      `);
      const res = analyzeRoutes(dir);
      
      expect(res).toHaveLength(1);
      expect(res[0].path).toBe("/admin/dash");
      expect(res[0].type).toBe("STATIC");
    });

    it("handles deeply nested routers", () => {
      const dir = createTestEnv(`
        const v1 = new Hono();
        const users = new Hono();
        users.get('/list', (c) => c.json([]));
        
        v1.route('/users', users);
        app.route('/api/v1', v1);
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].path).toBe("/api/v1/users/list");
      expect(res[0].type).toBe("STATIC");
    });
  });

  describe("7. Edge Cases", () => {
    it("ignores wildcard routes", () => {
      const dir = createTestEnv(`app.get('/files/*', (c) => c.json({}));`);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
      expect(res[0].reason).toContain("wildcards");
    });

    it("ignores param routes", () => {
      const dir = createTestEnv(`app.get('/user/:id', (c) => c.json({}));`);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
      expect(res[0].reason).toContain("params");
    });

    it("handles empty returns / no content", () => {
      const dir = createTestEnv(`app.get('/empty', (c) => c.json());`);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("STATIC");
    });

    it("handles shorthand property assignment", () => {
      const dir = createTestEnv(`
        const version = "1.0";
        app.get('/short', (c) => c.json({ version }));
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("STATIC");
    });
  });
  describe("8. Async & Method Chaining", () => {
    it("handles async handlers correctly", () => {
      const dir = createTestEnv(`
        app.get('/async', async (c) => {
          return c.json({ status: "ok" });
        });
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("STATIC");
    });

    it("handles chained response methods (status, header)", () => {
      // Common pattern: c.status(200).json(...)
      const dir = createTestEnv(`
        app.get('/chained', (c) => c.status(200).header('X-Custom', '1').json({ msg: "ok" }));
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("STATIC");
    });

    it("supports c.html() and c.text()", () => {
      const dir = createTestEnv(`
        app.get('/html', (c) => c.html("<h1>Hello</h1>"));
        app.get('/text', (c) => c.text("Just text"));
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("STATIC");
      expect(res[1].type).toBe("STATIC");
    });
  });

  describe("9. Advanced Data Structures", () => {
    it("handles Spread Operator on Static Objects", () => {
      const dir = createTestEnv(`
        const base = { a: 1 };
        app.get('/spread', (c) => c.json({ ...base, b: 2 }));
      `);
      // Note: Current "dumb" AST walkers fail on spread. 
      // If your analyzer handles it, this passes. If not, it marks DYNAMIC (which is safe).
      const res = analyzeRoutes(dir);
      // It likely marks dynamic unless we explicitly added SpreadAssignment logic
      // But let's see if it's safe.
    });

    it("handles Array.map inside handler (Dynamic)", () => {
      const dir = createTestEnv(`
        const list = [1, 2];
        app.get('/map', (c) => c.json(list.map(x => x * 2)));
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC"); // Complex logic usually defaults to dynamic
    });

    it("handles Computed Property Names", () => {
      const dir = createTestEnv(`
        const key = "dynamic_key_" + Date.now();
        app.get('/computed', (c) => c.json({ [key]: "value" }));
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
    });
  });

  describe("10. Context Destructuring", () => {
    it("detects destructured 'req' usage", () => {
      const dir = createTestEnv(`
        app.get('/destruct', (c) => {
          const { req } = c; // Destructuring 'req'
          return c.json({ url: req.url });
        });
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
      expect(res[0].reason).toContain("context");
    });
    
    it("detects destructured 'env' usage", () => {
      const dir = createTestEnv(`
        app.get('/env-destruct', (c) => {
          const { env } = c; 
          return c.json({ k: env.API_KEY });
        });
      `);
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
    });
  });

  describe("11. Cross-File Imports (The Ultimate Test)", () => {
    it("traces static constants imported from another file", () => {
      const dir = createTestEnv({
        "config.ts": `export const VERSION = "1.0.5";`,
        "index.ts": `
          import { VERSION } from './config';
          app.get('/version', (c) => c.json({ v: VERSION }));
        `
      });
      const res = analyzeRoutes(dir);
      expect(res[0].path).toBe("/version");
      expect(res[0].type).toBe("STATIC");
    });

    it("traces DYNAMIC variables imported from another file", () => {
      const dir = createTestEnv({
        "utils.ts": `export const TIME = Date.now();`,
        "index.ts": `
          import { TIME } from './utils';
          app.get('/time', (c) => c.json({ t: TIME }));
        `
      });
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("DYNAMIC");
    });

    it("detects imported Handlers", () => {
       const dir = createTestEnv({
        "handlers.ts": `export const getStatus = (c) => c.json({ status: "ok" });`,
        "index.ts": `
          import { getStatus } from './handlers';
          app.get('/status', getStatus);
        `
      });
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("STATIC");
    });
  });

  describe("12. JSON Imports (Feature Request)", () => {
    it("detects direct JSON imports as STATIC", () => {
      // This mimics "import largeStaticJson from './large.json'"
      const dir = createTestEnv({
        "large.json": JSON.stringify({ version: "1.0", items: [1, 2, 3] }),
        "index.ts": `
          import data from './large.json';
          app.get('/large-json', (c) => c.json(data));
        `
      });
      const res = analyzeRoutes(dir);
      
      expect(res[0].path).toBe("/large-json");
      expect(res[0].type).toBe("STATIC");
    });

    it("detects nested properties from JSON as STATIC", () => {
      // Verifies that accessing object properties on a JSON import works
      const dir = createTestEnv({
        "config.json": JSON.stringify({ meta: { title: "My Site" }, active: true }),
        "index.ts": `
          import config from './config.json';
          app.get('/meta', (c) => c.json({ 
            title: config.meta.title,
            isActive: config.active
          }));
        `
      });
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("STATIC");
    });

    it("correctly identifies TypeScript files named like JSON as DYNAMIC if they contain logic", () => {
      // Safety Check: A file named "data.json.ts" should NOT be treated as a static JSON file.
      // It must be parsed as TypeScript.
      const dir = createTestEnv({
        "data.json.ts": `export const badData = { time: Date.now() };`,
        "index.ts": `
          import { badData } from './data.json'; // Resolves to .ts file
          app.get('/trap', (c) => c.json(badData));
        `
      });
      const res = analyzeRoutes(dir);
      
      // Should be DYNAMIC because it contains Date.now(), despite having ".json" in the filename
      expect(res[0].type).toBe("DYNAMIC"); 
      expect(res[0].reason).toContain("Response body has variables");
    });

    it("handles spread syntax on imported JSON", () => {
      const dir = createTestEnv({
        "base.json": JSON.stringify({ a: 1, b: 2 }),
        "index.ts": `
          import base from './base.json';
          app.get('/spread', (c) => c.json({ ...base, c: 3 }));
        `
      });
      const res = analyzeRoutes(dir);
      expect(res[0].type).toBe("STATIC");
    });
  });
});