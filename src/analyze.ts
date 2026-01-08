import ts from "typescript";
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

  // 1. Setup Optimized Program
  const configFile = ts.readConfigFile(TS_CONFIG, ts.sys.readFile);
  const configParseResult = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectCwd);
  
  const program = ts.createProgram([ENTRY_FILE], {
    ...configParseResult.options,
    skipLibCheck: true,
    skipDefaultLibCheck: true,
    types: [],
    noEmit: true,
  });

  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(ENTRY_FILE);

  if (!sourceFile) return [];

  const results: RouteAnalysis[] = [];

  // 2. Index Identifiers
  const identifierMap = new Map<string, ts.Identifier[]>();
  function mapIdentifiers(node: ts.Node) {
    if (ts.isIdentifier(node)) {
      const text = node.text;
      if (!identifierMap.has(text)) identifierMap.set(text, []);
      identifierMap.get(text)!.push(node);
    }
    ts.forEachChild(node, mapIdentifiers);
  }
  mapIdentifiers(sourceFile);

  // 3. Recursive Router Analyzer
  function analyzeRouter(routerVarName: string, routePrefix: string) {
    const usages = identifierMap.get(routerVarName) || [];

    for (const usage of usages) {
      const parent = usage.parent;

      if (ts.isPropertyAccessExpression(parent) && parent.expression === usage) {
        const callExpr = parent.parent;
        
        if (ts.isCallExpression(callExpr)) {
          const method = parent.name.text;
          const args = callExpr.arguments;

          if (args.length === 0) continue;

          // A. Handle Routes
          if (["get", "post", "put", "delete", "patch"].includes(method)) {
            const pathNode = args[0];
            if (!pathNode) continue;

            if (ts.isStringLiteral(pathNode)) {
              const localPath = pathNode.text;
              const fullPath = (routePrefix + localPath).replace(/\/+/g, "/");

              if (fullPath.includes(":") || fullPath.includes("*")) {
                results.push({ method: method.toUpperCase(), path: fullPath, type: "DYNAMIC", reason: "Route has params/wildcards" });
                continue;
              }

              let routeStatus: "STATIC" | "DYNAMIC" = "STATIC";
              let failReason = "";

              for (let i = 1; i < args.length; i++) {
                const handlerNode = args[i];
                if (!handlerNode) continue;

                const analysis = analyzeHandler(handlerNode, checker);

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

          // B. Handle Sub-Routers
          if (method === "route" && args.length >= 2) {
            const pathNode = args[0];
            const subAppNode = args[1];

            if (pathNode && subAppNode && ts.isStringLiteral(pathNode) && ts.isIdentifier(subAppNode)) {
               const newPrefix = (routePrefix + pathNode.text).replace(/\/+/g, "/");
               analyzeRouter(subAppNode.text, newPrefix);
            }
          }
        }
      }
    }
  }

  // 4. Start Analysis
  let rootRouterName: string | undefined;

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isExportAssignment(node) && !node.isExportEquals && ts.isIdentifier(node.expression)) {
      rootRouterName = node.expression.text;
    }
  });

  if (!rootRouterName && identifierMap.has("app")) rootRouterName = "app";

  if (!rootRouterName) {
    ts.forEachChild(sourceFile, (node) => {
      if (!rootRouterName && ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach(decl => {
          if (decl.initializer && ts.isNewExpression(decl.initializer)) {
            const expr = decl.initializer.expression;
            if (ts.isIdentifier(expr) && expr.text.includes("Hono")) {
              if (ts.isIdentifier(decl.name)) rootRouterName = decl.name.text;
            }
          }
        });
      }
    });
  }

  if (rootRouterName) analyzeRouter(rootRouterName, "");

  return results.sort((a, b) => a.path.localeCompare(b.path));
}

// --- ANALYSIS HELPERS ---

function analyzeHandler(node: ts.Node, checker: ts.TypeChecker): { isStatic: boolean; reason?: string } {
  if (ts.isIdentifier(node)) {
    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol) return { isStatic: false, reason: "Unresolved Identifier" };
    
    const decl = getDeclaration(symbol, checker);
    if (!decl) return { isStatic: false, reason: "No definition found" };

    if (ts.isVariableDeclaration(decl) && decl.initializer) {
      return analyzeHandler(decl.initializer, checker);
    }
    if (ts.isFunctionDeclaration(decl)) {
      return analyzeFunctionBody(decl, checker);
    }
    return { isStatic: false, reason: "External function" };
  }

  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return analyzeFunctionBody(node, checker);
  }

  return { isStatic: false, reason: "Unknown Handler" };
}

function analyzeFunctionBody(func: ts.FunctionLikeDeclaration, checker: ts.TypeChecker): { isStatic: boolean; reason?: string } {
  const text = func.getText();
  
  // 1. Text Scan
  if (text.includes("Date.now()") || text.includes("Math.") || text.includes("process.env") || text.includes("bun.env")) {
    return { isStatic: false, reason: "Uses Dynamic Global" };
  }
  if (text.includes("next()")) {
    return { isStatic: false, reason: "Middleware chain (calls next)" };
  }

  // 2. Context Usage Scan (AST)
  const contextParam = func.parameters[0];
  if (contextParam && ts.isIdentifier(contextParam.name)) {
    const contextName = contextParam.name.text;
    let isImpure = false;
    let impurityReason = "";

    function checkContextUsage(n: ts.Node) {
      if (isImpure) return;
      
      // A. Check for Property Access: c.req, c.env
      if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression)) {
        if (n.expression.text === contextName) {
          const prop = n.name.text;
          const allowed = ["json", "text", "html", "body", "status", "header", "set", "var", "render"]; 
          if (!allowed.includes(prop)) {
            isImpure = true;
            impurityReason = `Uses dynamic context: c.${prop}`;
          }
        }
      }

      // B. Check for Destructuring: const { req } = c
      if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.initializer)) {
         if (n.initializer.text === contextName) {
            if (ts.isObjectBindingPattern(n.name)) {
               for (const el of n.name.elements) {
                  const propName = (el.propertyName || el.name).getText();
                  const allowed = ["json", "text", "html", "body", "status", "header", "set", "var", "render"]; 
                   if (!allowed.includes(propName)) {
                      isImpure = true;
                      impurityReason = `Uses dynamic context: c.${propName}`;
                   }
               }
            } else {
               isImpure = true;
               impurityReason = "Aliasing context object";
            }
         }
      }
      
      ts.forEachChild(n, checkContextUsage);
    }
    
    checkContextUsage(func.body || func);
    if (isImpure) return { isStatic: false, reason: impurityReason };
  }

  // 3. Return Analysis
  const body = func.body;
  if (!body) return { isStatic: false, reason: "No Body" };

  if (!ts.isBlock(body)) {
    return analyzeReturn(body, checker);
  }

  let hasReturn = false;
  let failReason: string | undefined;

  function findReturns(n: ts.Node) {
    if (failReason) return; 
    if (ts.isReturnStatement(n) && n.expression) {
      hasReturn = true;
      const res = analyzeReturn(n.expression, checker);
      if (!res.isStatic) failReason = res.reason;
    }
    if (!ts.isFunctionLike(n)) ts.forEachChild(n, findReturns);
  }
  
  findReturns(body);

  if (!hasReturn) return { isStatic: false, reason: "No return" };
  if (failReason) return { isStatic: false, reason: failReason };

  return { isStatic: true };
}

function analyzeReturn(expr: ts.Node, checker: ts.TypeChecker): { isStatic: boolean; reason?: string } {
  if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression)) {
    const method = expr.expression.name.text;
    
    if (["json", "text", "html"].includes(method)) {
        const arg = expr.arguments[0];
        if (!arg) return { isStatic: true };
        
        if (isDeeplyStatic(arg, checker)) return { isStatic: true };
        return { isStatic: false, reason: "Response body has variables" };
    }
  }
  return { isStatic: false, reason: "Complex return value" };
}

function isDeeplyStatic(node: ts.Node, checker: ts.TypeChecker, depth = 0): boolean {
  if (depth > 10) return false;

  const k = node.kind;
  
  if (
    ts.isStringLiteral(node) || 
    ts.isNumericLiteral(node) || 
    k === ts.SyntaxKind.TrueKeyword || 
    k === ts.SyntaxKind.FalseKeyword || 
    k === ts.SyntaxKind.NullKeyword ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) return true;

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.every(e => isDeeplyStatic(e, checker, depth + 1));
  }

  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.every(p => {
      // 1. Handle Spread Assignment: { ...base }
      if (ts.isSpreadAssignment(p)) {
         return isDeeplyStatic(p.expression, checker, depth + 1);
      }

      // 2. Handle Computed Properties: { [key]: val }
      // Only check name if it exists and is computed
      if (p.name && ts.isComputedPropertyName(p.name)) {
        if (!isDeeplyStatic(p.name.expression, checker, depth + 1)) return false;
      }
      
      // 3. Handle Values (PropertyAssignment or Shorthand)
      if (ts.isPropertyAssignment(p)) return isDeeplyStatic(p.initializer, checker, depth + 1);
      
      if (ts.isShorthandPropertyAssignment(p)) {
        const symbol = checker.getShorthandAssignmentValueSymbol(p);
        if (!symbol) return false;
        const decl = getDeclaration(symbol, checker);
        return decl && ts.isVariableDeclaration(decl) && decl.initializer 
          ? isDeeplyStatic(decl.initializer, checker, depth + 1) 
          : false;
      }
      return false; 
    });
  }

  if (ts.isPropertyAccessExpression(node)) {
    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol) return false;
    
    const decl = getDeclaration(symbol, checker);
    if (!decl) return false;

    if (ts.isPropertyAssignment(decl)) {
      return isDeeplyStatic(decl.initializer, checker, depth + 1);
    }
    if (ts.isVariableDeclaration(decl) && decl.initializer) {
      return isDeeplyStatic(decl.initializer, checker, depth + 1);
    }
  }

  if (ts.isIdentifier(node)) {
    if (node.text === "undefined") return true;
    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol) return false;

    const decl = getDeclaration(symbol, checker);
    if (decl && ts.isVariableDeclaration(decl) && decl.initializer) {
      const isConst = (ts.getCombinedNodeFlags(decl) & ts.NodeFlags.Const) !== 0;
      if (!isConst) return false;
      return isDeeplyStatic(decl.initializer, checker, depth + 1);
    }
  }

  return false;
}

function getDeclaration(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Declaration | undefined {
  if (symbol.flags & ts.SymbolFlags.Alias) {
    const alias = checker.getAliasedSymbol(symbol);
    return alias.valueDeclaration || alias.declarations?.[0];
  }
  return symbol.valueDeclaration || symbol.declarations?.[0];
}