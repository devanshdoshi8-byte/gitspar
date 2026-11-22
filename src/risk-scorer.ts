import { Project, SyntaxKind, FunctionDeclaration, MethodDeclaration, ArrowFunction, Node } from 'ts-morph';
import { existsSync, readFileSync } from 'node:fs';

export interface RiskScoreBreakdown {
  boundaryOperators: number;     // Up to +25
  sensitiveKeywords: number;     // Up to +30
  branchingComplexity: number;   // Up to +20
  missingJsDoc: number;          // Up to +15
}

export interface FunctionRiskResult {
  functionName: string;
  riskScore: number;             // 0 to 100
  reasons: string[];
  breakdown: RiskScoreBreakdown;
  startLine?: number;
  endLine?: number;
  parameters: string[];
}

export const SENSITIVE_KEYWORDS = [
  'discount',
  'price',
  'tax',
  'gst',
  'balance',
  'auth',
  'token',
  'limit',
  'refund',
  'credit',
] as const;

export const BOUNDARY_OPERATORS = ['>=', '<=', '>', '<', '===', '!=='] as const;

/**
 * Computes the risk score of a given ts-morph AST function node.
 */
export function scoreFunctionAstNode(
  fn: FunctionDeclaration | MethodDeclaration | ArrowFunction,
  functionNameOverride?: string
): FunctionRiskResult {
  const functionName =
    functionNameOverride ||
    (fn as FunctionDeclaration).getName?.() ||
    'anonymousFunction';

  const fnText = fn.getText();
  const reasons: string[] = [];
  const breakdown: RiskScoreBreakdown = {
    boundaryOperators: 0,
    sensitiveKeywords: 0,
    branchingComplexity: 0,
    missingJsDoc: 0,
  };

  // 1. Relational / Boundary Operators (+25)
  // Check for >=, <=, >, <, ===, !== in binary expressions or tokens
  const binaryExpressions = fn.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  const foundOperators = new Set<string>();

  for (const expr of binaryExpressions) {
    const opToken = expr.getOperatorToken().getText();
    if (BOUNDARY_OPERATORS.includes(opToken as any)) {
      foundOperators.add(opToken);
    }
  }

  // Fallback string search in case of arrow expression tokens
  if (foundOperators.size === 0) {
    for (const op of BOUNDARY_OPERATORS) {
      if (fnText.includes(op)) {
        foundOperators.add(op);
      }
    }
  }

  if (foundOperators.size > 0) {
    breakdown.boundaryOperators = 25;
    reasons.push(
      `Relational boundary operator(s) detected [${Array.from(foundOperators).join(', ')}] (+25) — vulnerable to off-by-one boundary defects`
    );
  }

  // 2. Financial, Auth, Security, or Rate-Limit Identifiers (+30)
  const matchedKeywords = new Set<string>();
  const lowerFnText = fnText.toLowerCase();

  for (const keyword of SENSITIVE_KEYWORDS) {
    // Regex for word boundary or identifier substring
    const regex = new RegExp(`\\b${keyword}|${keyword}\\b`, 'i');
    if (regex.test(lowerFnText)) {
      matchedKeywords.add(keyword);
    }
  }

  if (matchedKeywords.size > 0) {
    breakdown.sensitiveKeywords = 30;
    reasons.push(
      `Sensitive financial/auth/security identifier(s) detected: [${Array.from(matchedKeywords).join(', ')}] (+30)`
    );
  }

  // 3. Conditional Branching Depth (if / else / ternary / && / ||) (+20)
  const ifStatements = fn.getDescendantsOfKind(SyntaxKind.IfStatement);
  const conditionalExpressions = fn.getDescendantsOfKind(SyntaxKind.ConditionalExpression);
  let logicalOperatorCount = 0;

  for (const expr of binaryExpressions) {
    const op = expr.getOperatorToken().getText();
    if (op === '&&' || op === '||') {
      logicalOperatorCount++;
    }
  }

  const branchCount = ifStatements.length + conditionalExpressions.length + logicalOperatorCount;
  if (branchCount > 0) {
    breakdown.branchingComplexity = 20;
    reasons.push(
      `Conditional branching complexity detected (${ifStatements.length} if/else, ${conditionalExpressions.length} ternary, ${logicalOperatorCount} logical &&/||) (+20)`
    );
  }

  // 4. Missing JSDoc Specification (+15)
  let hasJsDoc = false;
  if ('getJsDocs' in fn && typeof (fn as any).getJsDocs === 'function') {
    const jsdocs = (fn as any).getJsDocs();
    hasJsDoc = Array.isArray(jsdocs) && jsdocs.length > 0;
  }

  if (!hasJsDoc) {
    // Check leading comment ranges
    const leadingComments = fn.getLeadingCommentRanges();
    for (const comment of leadingComments) {
      if (comment.getText().startsWith('/**')) {
        hasJsDoc = true;
        break;
      }
    }
  }

  if (!hasJsDoc) {
    breakdown.missingJsDoc = 15;
    reasons.push('Missing JSDoc specification for function contract and parameters (+15)');
  }

  // Total risk score (0 to 100)
  const riskScore = Math.min(
    100,
    breakdown.boundaryOperators +
      breakdown.sensitiveKeywords +
      breakdown.branchingComplexity +
      breakdown.missingJsDoc
  );

  const parameters = fn.getParameters().map((p) => p.getName());
  const startLine = fn.getStartLineNumber();
  const endLine = fn.getEndLineNumber();

  return {
    functionName,
    riskScore,
    reasons,
    breakdown,
    startLine,
    endLine,
    parameters,
  };
}

/**
 * Scores a function from either a file path or direct TypeScript source code string.
 */
export function scoreFunctionRisk(
  filePathOrCode: string,
  targetFunctionName?: string
): FunctionRiskResult {
  const project = new Project({ useInMemoryFileSystem: true });
  let sourceText = filePathOrCode;

  if (existsSync(filePathOrCode)) {
    sourceText = readFileSync(filePathOrCode, 'utf-8');
  }

  const sourceFile = project.createSourceFile('scoring-target.ts', sourceText);

  // Look for target function by name
  if (targetFunctionName) {
    const fnDecl = sourceFile.getFunction(targetFunctionName);
    if (fnDecl) {
      return scoreFunctionAstNode(fnDecl, targetFunctionName);
    }

    // Check variable declarations (e.g. const fn = (...) => ...)
    const varDecl = sourceFile.getVariableDeclaration(targetFunctionName);
    if (varDecl) {
      const initializer = varDecl.getInitializer();
      if (initializer && Node.isArrowFunction(initializer)) {
        return scoreFunctionAstNode(initializer, targetFunctionName);
      }
    }
  }

  // Fallback: score first exported or top-level function
  const functions = sourceFile.getFunctions();
  if (functions.length > 0) {
    const exportedFn = functions.find((f) => f.isExported()) || functions[0];
    return scoreFunctionAstNode(exportedFn, exportedFn.getName());
  }

  // Check arrow functions assigned to variables
  const variableStatements = sourceFile.getVariableStatements();
  for (const stmt of variableStatements) {
    for (const decl of stmt.getDeclarations()) {
      const init = decl.getInitializer();
      if (init && Node.isArrowFunction(init)) {
        return scoreFunctionAstNode(init, decl.getName());
      }
    }
  }

  // If no functions found, calculate basic source-level risk
  return scoreSourceTextLightweight(sourceText, targetFunctionName || 'unknownFunction');
}

/**
 * Scores all functions found in a source file or string.
 */
export function scoreAllFunctionsInSource(filePathOrCode: string): FunctionRiskResult[] {
  const project = new Project({ useInMemoryFileSystem: true });
  let sourceText = filePathOrCode;

  if (existsSync(filePathOrCode)) {
    sourceText = readFileSync(filePathOrCode, 'utf-8');
  }

  const sourceFile = project.createSourceFile('scoring-source.ts', sourceText);
  const results: FunctionRiskResult[] = [];

  for (const fn of sourceFile.getFunctions()) {
    results.push(scoreFunctionAstNode(fn));
  }

  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const init = decl.getInitializer();
      if (init && Node.isArrowFunction(init)) {
        results.push(scoreFunctionAstNode(init, decl.getName()));
      }
    }
  }

  return results;
}

/**
 * Lightweight regex-based scoring fallback (also usable in browser environments).
 */
export function scoreSourceTextLightweight(
  sourceCode: string,
  functionName: string = 'assessedFunction'
): FunctionRiskResult {
  const reasons: string[] = [];
  const breakdown: RiskScoreBreakdown = {
    boundaryOperators: 0,
    sensitiveKeywords: 0,
    branchingComplexity: 0,
    missingJsDoc: 0,
  };

  // 1. Boundary Operators (+25)
  const ops = ['>=', '<=', '===', '!==', '>', '<'];
  const matchedOps = ops.filter((op) => sourceCode.includes(op));
  if (matchedOps.length > 0) {
    breakdown.boundaryOperators = 25;
    reasons.push(`Boundary operators detected: [${matchedOps.join(', ')}] (+25)`);
  }

  // 2. Sensitive Keywords (+30)
  const lower = sourceCode.toLowerCase();
  const matchedKeywords = SENSITIVE_KEYWORDS.filter((kw) => {
    const reg = new RegExp(`\\b${kw}|${kw}\\b`, 'i');
    return reg.test(lower);
  });
  if (matchedKeywords.length > 0) {
    breakdown.sensitiveKeywords = 30;
    reasons.push(`Sensitive business/security keywords detected: [${matchedKeywords.join(', ')}] (+30)`);
  }

  // 3. Branching (+20)
  const hasIf = /\bif\s*\(/.test(sourceCode);
  const hasTernary = /\?.*:/.test(sourceCode);
  const hasLogical = /&&|\|\|/.test(sourceCode);
  if (hasIf || hasTernary || hasLogical) {
    breakdown.branchingComplexity = 20;
    reasons.push('Conditional branching logic (if/ternary/&&/||) (+20)');
  }

  // 4. Missing JSDoc (+15)
  if (!sourceCode.includes('/**')) {
    breakdown.missingJsDoc = 15;
    reasons.push('Missing JSDoc documentation specification (+15)');
  }

  const riskScore = Math.min(
    100,
    breakdown.boundaryOperators +
      breakdown.sensitiveKeywords +
      breakdown.branchingComplexity +
      breakdown.missingJsDoc
  );

  return {
    functionName,
    riskScore,
    reasons,
    breakdown,
    parameters: [],
  };
}
