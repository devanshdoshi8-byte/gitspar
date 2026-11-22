import { describe, it, expect } from 'vitest';
import {
  scoreFunctionRisk,
  scoreAllFunctionsInSource,
  scoreSourceTextLightweight,
  SENSITIVE_KEYWORDS,
  BOUNDARY_OPERATORS,
} from '../src/risk-scorer.js';

describe('Risk-Weighted Diff Scorer (src/risk-scorer.ts)', () => {
  it('assigns high risk score (90+) to functions with boundary conditions, sensitive keywords, and branching without JSDoc', () => {
    const code = `
export function calculateTierDiscount(orderTotal: number, isStudent: boolean): number {
  if (orderTotal >= 100) {
    if (isStudent) {
      return orderTotal * 0.8;
    }
    return orderTotal * 0.9;
  }
  return isStudent ? orderTotal * 0.95 : orderTotal;
}
`;

    const result = scoreFunctionRisk(code, 'calculateTierDiscount');

    expect(result.functionName).toBe('calculateTierDiscount');
    expect(result.breakdown.boundaryOperators).toBe(25); // >= present
    expect(result.breakdown.sensitiveKeywords).toBe(30); // discount present
    expect(result.breakdown.branchingComplexity).toBe(20); // if/else and ternary present
    expect(result.breakdown.missingJsDoc).toBe(15); // no JSDoc present
    expect(result.riskScore).toBe(90); // 25 + 30 + 20 + 15 = 90
    expect(result.reasons.length).toBe(4);
  });

  it('assigns low risk score (0) to documented pure mathematical functions without boundary ops or sensitive keywords', () => {
    const code = `
/**
 * Computes the Euclidean norm of a 2D coordinate.
 * @param x - X coordinate
 * @param y - Y coordinate
 */
export function computeEuclideanNorm(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}
`;

    const result = scoreFunctionRisk(code, 'computeEuclideanNorm');

    expect(result.breakdown.boundaryOperators).toBe(0);
    expect(result.breakdown.sensitiveKeywords).toBe(0);
    expect(result.breakdown.branchingComplexity).toBe(0);
    expect(result.breakdown.missingJsDoc).toBe(0); // Documented with JSDoc
    expect(result.riskScore).toBe(0);
    expect(result.reasons.length).toBe(0);
  });

  it('detects all specified sensitive financial and security keywords', () => {
    for (const keyword of SENSITIVE_KEYWORDS) {
      const code = `
export function process${keyword.toUpperCase()}(input: number): number {
  return input;
}
`;
      const result = scoreFunctionRisk(code);
      expect(result.breakdown.sensitiveKeywords).toBe(30);
      expect(result.reasons.some((r) => r.toLowerCase().includes(keyword.toLowerCase()))).toBe(true);
    }
  });

  it('detects all specified boundary relational operators (>=, <=, >, <, ===, !==)', () => {
    for (const op of BOUNDARY_OPERATORS) {
      const code = `
export function testOp(a: number, b: number): boolean {
  return a ${op} b;
}
`;
      const result = scoreFunctionRisk(code);
      expect(result.breakdown.boundaryOperators).toBe(25);
    }
  });

  it('scores multiple functions in a single source file', () => {
    const multiCode = `
export function highRiskAuth(token: string): boolean {
  if (token.length >= 32) return true;
  return false;
}

/**
 * Low risk utility.
 */
export function lowRiskAdd(a: number, b: number): number {
  return a + b;
}
`;

    const all = scoreAllFunctionsInSource(multiCode);
    expect(all.length).toBe(2);

    const highRisk = all.find((f) => f.functionName === 'highRiskAuth')!;
    const lowRisk = all.find((f) => f.functionName === 'lowRiskAdd')!;

    expect(highRisk.riskScore).toBeGreaterThanOrEqual(75);
    expect(lowRisk.riskScore).toBe(0);
  });

  it('scoreSourceTextLightweight runs reliably with matching breakdown', () => {
    const code = `
export function checkRateLimit(requestCount: number, maxLimit: number): boolean {
  if (requestCount <= maxLimit) {
    return true;
  }
  return false;
}
`;

    const result = scoreSourceTextLightweight(code, 'checkRateLimit');
    expect(result.breakdown.boundaryOperators).toBe(25);
    expect(result.breakdown.sensitiveKeywords).toBe(30); // limit
    expect(result.breakdown.branchingComplexity).toBe(20); // if
    expect(result.breakdown.missingJsDoc).toBe(15);
    expect(result.riskScore).toBe(90);
  });
});
