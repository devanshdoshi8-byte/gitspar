export interface RiskScoreBreakdown {
  boundaryOperators: number;     // Up to +25
  sensitiveKeywords: number;     // Up to +30
  branchingComplexity: number;   // Up to +20
  missingJsDoc: number;          // Up to +15
}

export interface FunctionRiskResult {
  functionName: string;
  signature: string;
  parameters: string[];
  code: string;
  riskScore: number;             // 0 to 100
  reasons: string[];
  breakdown: RiskScoreBreakdown;
  startLine?: number;
  endLine?: number;
  defaultArgs?: string;
  defaultExpected?: string;
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
 * Client-side browser-compatible Risk Scorer.
 * Analyzes pure TypeScript/JavaScript function code string.
 */
export function scoreFunctionCode(
  functionCode: string,
  functionName: string = 'assessedFunction',
  signature: string = ''
): FunctionRiskResult {
  const reasons: string[] = [];
  const breakdown: RiskScoreBreakdown = {
    boundaryOperators: 0,
    sensitiveKeywords: 0,
    branchingComplexity: 0,
    missingJsDoc: 0,
  };

  // 1. Boundary Operators (+25)
  const matchedOps: string[] = [];
  for (const op of BOUNDARY_OPERATORS) {
    if (functionCode.includes(op)) {
      matchedOps.push(op);
    }
  }

  if (matchedOps.length > 0) {
    breakdown.boundaryOperators = 25;
    reasons.push(`Boundary operators detected: [${matchedOps.join(', ')}] (+25) — vulnerable to off-by-one errors`);
  }

  // 2. Sensitive Business/Security Keywords (+30)
  const lower = functionCode.toLowerCase();
  const matchedKeywords: string[] = [];
  for (const kw of SENSITIVE_KEYWORDS) {
    const reg = new RegExp(`\\b${kw}|${kw}\\b`, 'i');
    if (reg.test(lower)) {
      matchedKeywords.push(kw);
    }
  }

  if (matchedKeywords.length > 0) {
    breakdown.sensitiveKeywords = 30;
    reasons.push(`Sensitive financial/security identifiers: [${matchedKeywords.join(', ')}] (+30)`);
  }

  // 3. Conditional Branching Complexity (+20)
  const hasIf = /\bif\s*\(/.test(functionCode);
  const hasTernary = /\?.*:/.test(functionCode);
  const hasLogical = /&&|\|\|/.test(functionCode);

  if (hasIf || hasTernary || hasLogical) {
    breakdown.branchingComplexity = 20;
    reasons.push('Conditional branching logic (if/ternary/&&/||) (+20) increasing cyclomatic complexity');
  }

  // 4. Missing JSDoc (+15)
  if (!functionCode.includes('/**')) {
    breakdown.missingJsDoc = 15;
    reasons.push('Missing JSDoc specification for function contract and parameters (+15)');
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
    signature: signature || `${functionName}(...)`,
    parameters: [],
    code: functionCode,
    riskScore,
    reasons,
    breakdown,
  };
}

/**
 * Parses exported functions from a TypeScript source file client-side.
 */
export function parseExportedFunctionsFromSource(sourceCode: string): FunctionRiskResult[] {
  const results: FunctionRiskResult[] = [];
  const lines = sourceCode.split(/\r?\n/);

  // Match: export function name(args): returnType {
  const fnRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = fnRegex.exec(sourceCode)) !== null) {
    const fnName = match[1];
    const rawParams = match[2];
    const returnType = match[3] ? match[3].trim() : 'any';
    const startIndex = match.index;

    // Find closing brace matching the opening brace
    let braceCount = 0;
    let endIndex = startIndex;
    let foundOpen = false;

    for (let i = startIndex; i < sourceCode.length; i++) {
      if (sourceCode[i] === '{') {
        braceCount++;
        foundOpen = true;
      } else if (sourceCode[i] === '}') {
        braceCount--;
        if (foundOpen && braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    const fullCode = sourceCode.slice(startIndex, endIndex);
    const paramNames = rawParams
      .split(',')
      .map((p) => p.trim().split(':')[0].trim())
      .filter(Boolean);

    const signature = `${fnName}(${rawParams.trim()}): ${returnType}`;
    const scored = scoreFunctionCode(fullCode, fnName, signature);
    scored.parameters = paramNames;

    // Estimate sensible default arguments based on types
    const defaultArgs = paramNames
      .map((p) => {
        const lower = p.toLowerCase();
        if (lower.includes('total') || lower.includes('age') || lower.includes('count') || lower.includes('limit') || lower.includes('amount') || lower.includes('qty')) {
          return '100';
        }
        if (lower.includes('is') || lower.includes('has') || lower.includes('enabled') || lower.includes('flag')) {
          return 'false';
        }
        return '"test"';
      })
      .join(', ');

    scored.defaultArgs = defaultArgs || '100, false';
    scored.defaultExpected = returnType.includes('boolean') ? 'true' : returnType.includes('number') ? '90' : '"expected"';

    results.push(scored);
  }

  // Also check: export const fn = (...) => {
  const arrowRegex = /export\s+const\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)(?:\s*:\s*([^=>]+))?\s*=>\s*\{/g;
  while ((match = arrowRegex.exec(sourceCode)) !== null) {
    const fnName = match[1];
    const rawParams = match[2];
    const returnType = match[3] ? match[3].trim() : 'any';
    const startIndex = match.index;

    let braceCount = 0;
    let endIndex = startIndex;
    let foundOpen = false;

    for (let i = startIndex; i < sourceCode.length; i++) {
      if (sourceCode[i] === '{') {
        braceCount++;
        foundOpen = true;
      } else if (sourceCode[i] === '}') {
        braceCount--;
        if (foundOpen && braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    const fullCode = sourceCode.slice(startIndex, endIndex);
    const paramNames = rawParams
      .split(',')
      .map((p) => p.trim().split(':')[0].trim())
      .filter(Boolean);

    const signature = `${fnName}(${rawParams.trim()}): ${returnType}`;
    const scored = scoreFunctionCode(fullCode, fnName, signature);
    scored.parameters = paramNames;
    scored.defaultArgs = '100, false';
    scored.defaultExpected = returnType.includes('boolean') ? 'true' : '90';

    results.push(scored);
  }

  return results;
}
