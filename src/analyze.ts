import { Project, SyntaxKind, Node } from "ts-morph";
import path from "path";
import fs from "fs";

export type RouteAnalysis = {
  method: string;
  path: string;
  type: "STATIC" | "DYNAMIC";
  reason?: string;
};

/**
 * Analyzes the user's Hono server to detect static vs dynamic routes.
 * @param projectCwd The root directory of the user's project (default: process.cwd())
 */
export function analyzeRoutes(projectCwd: string = process.cwd()): RouteAnalysis[] {
  const TS_CONFIG = path.join(projectCwd, "tsconfig.json");
  const ENTRY_FILE = path.join(projectCwd, "server", "index.ts");

  if (!fs.existsSync(ENTRY_FILE)) {
    console.warn(`\x1b[33m[ANALYZE]\x1b[0m skipped: Could not find server/index.ts at ${ENTRY_FILE}`);
    return [];
  }

  const projectOptions = fs.existsSync(TS_CONFIG) 
    ? { tsConfigFilePath: TS_CONFIG, skipAddingFilesFromTsConfig: true }
    : {};

  const project = new Project(projectOptions);

  try {
    project.addSourceFileAtPath(ENTRY_FILE);
    project.resolveSourceFileDependencies();
  } catch (e) {
    console.error(`\x1b[31m[ANALYZE]\x1b[0m Failed to load source files:`, e);
    return [];
  }

  const results: RouteAnalysis[] = [];

  // --- INTERNAL HELPER: Recursively Analyze Router Variables ---
  function analyzeRouter(node: Node, routePrefix: string = "") {
    // 1. Trace Identifiers (Variables)
    if (Node.isIdentifier(node)) {
      const definitions = node.getDefinitions();
      if (definitions.length > 0) {
        // [FIX] Optional chaining for safe access
        const decl = definitions[0]?.getDeclarationNode();
        if (decl && (Node.isImportSpecifier(decl) || Node.isImportClause(decl))) return;
        if (decl && Node.isVariableDeclaration(decl)) {
          const initializer = decl.getInitializer();
          if (initializer) analyzeRouter(initializer, routePrefix);
          return;
        }
      }
    }

    // 2. Find usage in source file
    const sourceFile = node.getSourceFile();
    let varName = "";

    if (Node.isVariableDeclaration(node)) {
      varName = node.getName();
    } else if (Node.isNewExpression(node)) {
      const parent = node.getParent();
      if (Node.isVariableDeclaration(parent)) varName = parent.getName();
    }

    if (varName) {
      const references = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
        .filter(id => id.getText() === varName);

      for (const ref of references) {
        const parent = ref.getParent();

        // Check for: app.get(), app.post(), app.route()
        if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === ref) {
          const callExpr = parent.getParent();
          if (Node.isCallExpression(callExpr)) {
            const method = parent.getName();
            const args = callExpr.getArguments();

            if (args.length === 0) continue;

            // HANDLE METHODS: app.get, app.post, etc.
            if (["get", "post", "put", "delete", "patch"].includes(method)) {
              const pathNode = args[0];
              // [FIX] Ensure pathNode exists (though length check above handles it usually)
              if (pathNode && Node.isStringLiteral(pathNode)) {
                const localPath = pathNode.getLiteralText();
                const fullPath = (routePrefix + localPath).replace(/\/+/g, "/");

                let routeStatus: "STATIC" | "DYNAMIC" = "STATIC";
                let failReason = "";

                // Check EVERY argument (Middlewares + Handler)
                for (let i = 1; i < args.length; i++) {
                  // [FIX] Safe access or non-null assertion since we are iterating known length
                  const handlerNode = args[i];
                  if (!handlerNode) continue;

                  const analysis = analyzeHandler(handlerNode);

                  if (!analysis.isStatic) {
                    routeStatus = "DYNAMIC";
                    const isMiddleware = i < args.length - 1;
                    failReason = isMiddleware
                      ? `Middleware [Arg ${i}] is dynamic: ${analysis.reason}`
                      : analysis.reason || "Unknown";
                    break;
                  }
                }

                results.push({
                  method: method.toUpperCase(),
                  path: fullPath,
                  type: routeStatus,
                  reason: routeStatus === "DYNAMIC" ? failReason : undefined
                });
              }
            }

            // HANDLE ROUTER: app.route('/auth', authApp)
            if (method === "route") {
              const pathNode = args[0];
              const subAppNode = args[1];
              if (pathNode && Node.isStringLiteral(pathNode) && subAppNode) {
                const newPrefix = (routePrefix + pathNode.getLiteralText()).replace(/\/+/g, "/");
                analyzeRouter(subAppNode, newPrefix);
              }
            }
          }
        }
      }
    }
  }

  // Start analysis
  const entrySourceFile = project.getSourceFileOrThrow(ENTRY_FILE);
  const honoVars = entrySourceFile.getVariableDeclarations().filter(decl => {
    const init = decl.getInitializer();
    return init && Node.isNewExpression(init) && init.getExpression().getText().includes("Hono");
  });

  if (honoVars.length > 0 && honoVars[0]) {
    // [FIX] Explicit check or guaranteed existence due to length > 0
    analyzeRouter(honoVars[0]);
  }

  return results.sort((a, b) => a.path.localeCompare(b.path));
}


// --- PRIVATE AST HELPERS ---

function analyzeHandler(node: Node): { isStatic: boolean; reason?: string } {
  let funcBody = node;

  // Resolve Identifier (e.g., imported handlers)
  if (Node.isIdentifier(node)) {
    const defs = node.getDefinitions();
    if (defs.length > 0) {
      // [FIX] Safe access
      const decl = defs[0]?.getDeclarationNode();
      if (decl && Node.isVariableDeclaration(decl) && decl.getInitializer()) {
        const init = decl.getInitializer();
        if (init) funcBody = init;
      } else if (decl && Node.isFunctionDeclaration(decl)) {
        funcBody = decl;
      } else {
        return { isStatic: false, reason: `External/Imported function '${node.getText()}'` };
      }
    } else {
      return { isStatic: false, reason: "Unresolvable Identifier" };
    }
  }

  if (
    Node.isArrowFunction(funcBody) || 
    Node.isFunctionExpression(funcBody) || 
    Node.isFunctionDeclaration(funcBody)
  ) {
    const text = funcBody.getText();
    
    // Strict Global Checks
    if (text.includes("Date.now()") || text.includes("Math.") || text.includes("process.") || text.includes("new Date")) {
      return { isStatic: false, reason: "Uses Dynamic Global" };
    }
    // Strict Middleware Check
    if (text.includes("next()")) {
      return { isStatic: false, reason: "Middleware chain (calls next)" };
    }

    // Handle Implicit Returns: (c) => c.json(...)
    if (Node.isArrowFunction(funcBody)) {
      const body = funcBody.getBody();
      if (!Node.isBlock(body)) {
        return analyzeReturnExpression(body);
      }
    }

    // Handle Explicit Returns
    const returns = funcBody.getDescendantsOfKind(SyntaxKind.ReturnStatement);
    if (returns.length === 0) return { isStatic: false, reason: "No implicit or explicit return" };

    for (const ret of returns) {
      const expr = ret.getExpression();
      if (!expr) return { isStatic: false, reason: "Empty return statement" };
      
      const analysis = analyzeReturnExpression(expr);
      if (!analysis.isStatic) return analysis;
    }

    return { isStatic: true };
  }

  return { isStatic: false, reason: "Unknown Structure" };
}

function analyzeReturnExpression(expr: Node): { isStatic: boolean; reason?: string } {
  if (Node.isCallExpression(expr)) {
    const propAccess = expr.getExpression();
    
    // Handle chaining: c.status(200).json(...)
    if (Node.isPropertyAccessExpression(propAccess) && ["json", "text", "html"].includes(propAccess.getName())) {
      // [FIX] Check for undefined arguments
      const jsonArg = expr.getArguments()[0];
      if (!jsonArg) {
         // c.json() with no args? Likely an error or empty response, treating as Static Empty
         return { isStatic: true }; 
      }
      
      if (!isDeeplyStatic(jsonArg)) {
        return { isStatic: false, reason: "Response body has variables" };
      }
      return { isStatic: true };
    }
  }
  return { isStatic: false, reason: "Complex return value (not c.json)" };
}

function isDeeplyStatic(node: Node, depth = 0): boolean {
  if (depth > 10) return false;

  const kind = node.getKind();
  // Keywords
  if (kind === SyntaxKind.TrueKeyword || kind === SyntaxKind.FalseKeyword || kind === SyntaxKind.NullKeyword) return true;

  // Literals
  if (
    Node.isStringLiteral(node) || 
    Node.isNumericLiteral(node) ||
    Node.isNoSubstitutionTemplateLiteral(node)
  ) return true;

  // Arrays
  if (Node.isArrayLiteralExpression(node)) {
    return node.getElements().every(e => isDeeplyStatic(e, depth + 1));
  }

  // Objects
  if (Node.isObjectLiteralExpression(node)) {
    return node.getProperties().every(p => {
      // Shorthand: { version } -> trace 'version'
      if (Node.isShorthandPropertyAssignment(p)) {
        return isDeeplyStatic(p.getNameNode(), depth + 1);
      }
      // Assignment: key: value
      if (Node.isPropertyAssignment(p)) {
        const nameNode = p.getNameNode();
        // Reject computed keys: { [key]: val }
        if (nameNode.getKind() === SyntaxKind.ComputedPropertyName) return false;
        
        const init = p.getInitializer();
        // [FIX] Ensure initializer exists
        return init ? isDeeplyStatic(init, depth + 1) : false;
      }
      return false; // Spread, methods etc.
    });
  }

  // Identifier Tracing
  if (Node.isIdentifier(node)) {
    const defs = node.getDefinitions();
    if (defs.length > 0) {
      // [FIX] Safe access
      const decl = defs[0]?.getDeclarationNode();
      if (decl && Node.isVariableDeclaration(decl)) {
        const init = decl.getInitializer();
        return init ? isDeeplyStatic(init, depth + 1) : false;
      }
    }
  }

  return false;
}