import { Project, SyntaxKind, FunctionDeclaration, Node, NumericLiteral, BinaryExpression } from 'ts-morph';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { BOUNDARY_OPERATORS } from './risk-scorer.js';

export type ProbeCategory =
  | 'boundary_threshold'
  | 'zero_empty_nullish'
  | 'floating_point_precision'
  | 'concurrency_async';

export interface ParameterSpec {
  name: string;
  typeText: string;
  isOptional: boolean;
  baseType: 'number' | 'string' | 'boolean' | 'array' | 'object' | 'unknown';
}

export interface ExecutedProbe {
  probeId: string;
  category: ProbeCategory;
  categoryLabel: string;
  description: string;
  inputArgs: unknown[];
  inputArgsJson: string;
  actualOutput: unknown;
  actualOutputJson: string;
  isFloatOutput: boolean;
  executionMs: number;
  error?: string;
}

export interface ProbeSynthesisResult {
  functionName: string;
  filePath: string;
  isAsync: boolean;
  parameters: ParameterSpec[];
  boundaryLiterals: number[];
  probes: ExecutedProbe[];
}

/**
 * Parses parameters and extracts type specifications from a ts-morph function node.
 */
export function extractParameterSpecs(fn: FunctionDeclaration): ParameterSpec[] {
  return fn.getParameters().map((param) => {
    const name = param.getName();
    const typeText = param.getType().getText();
    const isOptional = param.isOptional() || param.hasInitializer();

    let baseType: ParameterSpec['baseType'] = 'unknown';
    const lowerType = typeText.toLowerCase();

    if (lowerType.includes('number')) {
      baseType = 'number';
    } else if (lowerType.includes('boolean')) {
      baseType = 'boolean';
    } else if (lowerType.includes('string')) {
      baseType = 'string';
    } else if (lowerType.includes('[]') || lowerType.includes('array')) {
      baseType = 'array';
    } else if (lowerType.includes('object') || lowerType.includes('{')) {
      baseType = 'object';
    }

    return {
      name,
      typeText,
      isOptional,
      baseType,
    };
  });
}

/**
 * Extracts numeric boundary literals from relational binary expressions (>=, <=, >, <, ===, !==).
 */
export function extractBoundaryLiterals(fn: FunctionDeclaration): number[] {
  const literals = new Set<number>();
  const binaryExpressions = fn.getDescendantsOfKind(SyntaxKind.BinaryExpression);

  for (const expr of binaryExpressions) {
    const op = expr.getOperatorToken().getText();
    if (BOUNDARY_OPERATORS.includes(op as any)) {
      const left = expr.getLeft();
      const right = expr.getRight();

      if (Node.isNumericLiteral(left)) {
        literals.add(parseFloat(left.getLiteralValue().toString()));
      }
      if (Node.isNumericLiteral(right)) {
        literals.add(parseFloat(right.getLiteralValue().toString()));
      }
    }
  }

  // If no relational literals found, scan all numeric literals in body
  if (literals.size === 0) {
    const allNums = fn.getDescendantsOfKind(SyntaxKind.NumericLiteral);
    for (const num of allNums) {
      const val = parseFloat(num.getLiteralValue().toString());
      if (!isNaN(val) && val > 0) {
        literals.add(val);
      }
    }
  }

  return Array.from(literals);
}

/**
 * Deterministically synthesizes 2-3 high-signal probe input vectors based on parameter types and AST boundaries.
 */
export function synthesizeTypeValidProbeInputs(
  parameters: ParameterSpec[],
  boundaryLiterals: number[],
  isAsync: boolean = false
): { category: ProbeCategory; categoryLabel: string; description: string; inputArgs: unknown[] }[] {
  const probes: { category: ProbeCategory; categoryLabel: string; description: string; inputArgs: unknown[] }[] = [];

  const mainBoundary = boundaryLiterals.length > 0 ? boundaryLiterals[0] : 100;

  // 1. Exact Boundary Threshold Probe
  const boundaryArgs = parameters.map((param, idx) => {
    if (param.baseType === 'number') {
      return idx === 0 ? mainBoundary : 0;
    }
    if (param.baseType === 'boolean') {
      return false;
    }
    if (param.baseType === 'string') {
      return 'standard';
    }
    if (param.baseType === 'array') {
      return [];
    }
    return null;
  });

  probes.push({
    category: 'boundary_threshold',
    categoryLabel: 'Exact Boundary Threshold',
    description: `Exact boundary value (${mainBoundary}) against relational condition.`,
    inputArgs: boundaryArgs,
  });

  // 2. Zero / Empty / Nullish Parameter Probe
  const zeroArgs = parameters.map((param) => {
    if (param.baseType === 'number') {
      return 0;
    }
    if (param.baseType === 'boolean') {
      return false;
    }
    if (param.baseType === 'string') {
      return '';
    }
    if (param.baseType === 'array') {
      return [];
    }
    return param.isOptional ? undefined : null;
  });

  probes.push({
    category: 'zero_empty_nullish',
    categoryLabel: 'Zero / Empty / Nullish Baseline',
    description: 'Zero or empty input to verify lower-bound guards & defaults.',
    inputArgs: zeroArgs,
  });

  // 3. Floating-Point Precision / Penny-Rounding Probe
  const floatArgs = parameters.map((param, idx) => {
    if (param.baseType === 'number') {
      // Test input that produces fractional or IEEE-754 precision issues
      return idx === 0 ? mainBoundary + 1 : 1;
    }
    if (param.baseType === 'boolean') {
      return true; // Flip boolean to trigger student/special rate multiplier
    }
    if (param.baseType === 'string') {
      return 'precision_test';
    }
    if (param.baseType === 'array') {
      return [1];
    }
    return null;
  });

  probes.push({
    category: 'floating_point_precision',
    categoryLabel: 'Floating-Point / Penny Rounding',
    description: `Fractional rate calculation on boundary + 1 (${mainBoundary + 1}) to detect precision leak.`,
    inputArgs: floatArgs,
  });

  return probes;
}

/**
 * Formats a value with IEEE-754 floating-point tolerance (1e-6).
 */
export function formatValueWithFloatTolerance(val: unknown): { formatted: string; isFloat: boolean } {
  if (typeof val === 'number') {
    if (!Number.isInteger(val)) {
      // Round to 4 decimal places for clean display
      const rounded = Number(val.toFixed(4));
      return { formatted: String(rounded), isFloat: true };
    }
    return { formatted: String(val), isFloat: false };
  }
  return { formatted: JSON.stringify(val), isFloat: false };
}

/**
 * Executes a function in an isolated Node sandbox and captures execution metrics.
 */
export async function executeProbeInSandbox(
  filePath: string,
  functionName: string,
  inputArgs: unknown[],
  cwd: string = process.cwd()
): Promise<{ actualOutput: unknown; executionMs: number; error?: string }> {
  const absPath = resolve(cwd, filePath).replace(/\\/g, '/');
  const fileUrl = `${pathToFileURL(absPath).href}?t=${Date.now()}`;

  const t0 = performance.now();
  try {
    const mod = await import(fileUrl);
    const fn = mod[functionName];
    if (typeof fn === 'function') {
      const raw = fn(...inputArgs);
      const res = raw && typeof raw.then === 'function' ? await raw : raw;
      const ms = Math.round((performance.now() - t0) * 100) / 100;
      return { actualOutput: res, executionMs: ms };
    }
  } catch {}

  const tempDir = resolve(cwd, '.gitspar/temp');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const runnerPath = resolve(tempDir, `probe-exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.ts`);
  const inputJson = JSON.stringify(inputArgs);

  const runnerContent = `
import { ${functionName} } from '${pathToFileURL(absPath).href}';
const t0 = performance.now();
try {
  const val = ${functionName}(...${inputJson});
  if (val && typeof (val as any).then === 'function') {
    (val as Promise<any>).then((asyncVal) => {
      const ms = performance.now() - t0;
      console.log('__GITSPAR_OUTPUT__:' + JSON.stringify({ ok: true, result: asyncVal, ms }));
    }).catch((err) => {
      const ms = performance.now() - t0;
      console.log('__GITSPAR_OUTPUT__:' + JSON.stringify({ ok: false, error: (err as Error).message, ms }));
    });
  } else {
    const ms = performance.now() - t0;
    console.log('__GITSPAR_OUTPUT__:' + JSON.stringify({ ok: true, result: val, ms }));
  }
} catch (err: any) {
  const ms = performance.now() - t0;
  console.log('__GITSPAR_OUTPUT__:' + JSON.stringify({ ok: false, error: (err as Error).message, ms }));
}
`;

  writeFileSync(runnerPath, runnerContent, 'utf-8');

  try {
    const output = execSync(`npx tsx "${runnerPath.replace(/\\/g, '/')}"`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });

    try {
      rmSync(runnerPath, { force: true });
    } catch {}

    const match = output.split('\n').find((line) => line.includes('__GITSPAR_OUTPUT__:'));
    if (match) {
      const jsonStr = match.substring(match.indexOf('__GITSPAR_OUTPUT__:') + '__GITSPAR_OUTPUT__:'.length);
      const parsed = JSON.parse(jsonStr.trim());
      if (parsed.ok) {
        return {
          actualOutput: parsed.result,
          executionMs: Math.round(parsed.ms * 100) / 100,
        };
      }
      return {
        actualOutput: null,
        executionMs: Math.round((parsed.ms || 0) * 100) / 100,
        error: parsed.error,
      };
    }

    return {
      actualOutput: null,
      executionMs: 0,
      error: 'No output marker from runner',
    };
  } catch (err: unknown) {
    try {
      rmSync(runnerPath, { force: true });
    } catch {}
    return {
      actualOutput: null,
      executionMs: 0,
      error: (err as Error).message || 'Execution error in sandbox',
    };
  }
}

/**
 * Main entry point: Synthesizes and executes high-signal edge-case probes for a high-risk function.
 */
export async function probeHighRiskFunction(
  filePathOrCode: string,
  functionName?: string,
  cwd: string = process.cwd()
): Promise<ProbeSynthesisResult> {
  const project = new Project({ useInMemoryFileSystem: true });
  let sourceText = filePathOrCode;
  let targetFilePath = filePathOrCode;

  if (existsSync(filePathOrCode)) {
    sourceText = readFileSync(filePathOrCode, 'utf-8');
    targetFilePath = filePathOrCode;
  } else {
    // If raw code was passed, save temporarily to .gitspar/temp/probe-target.ts
    const tempDir = resolve(cwd, '.gitspar/temp');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
    targetFilePath = resolve(tempDir, 'probe-target.ts');
    writeFileSync(targetFilePath, sourceText, 'utf-8');
  }

  const sourceFile = project.createSourceFile('probe-ast.ts', sourceText);

  // Find target function
  let targetFn: FunctionDeclaration | undefined;
  if (functionName) {
    targetFn = sourceFile.getFunction(functionName);
  }
  if (!targetFn) {
    const funcs = sourceFile.getFunctions();
    targetFn = funcs.find((f) => f.isExported()) || funcs[0];
  }

  if (!targetFn) {
    throw new Error(`[OracleProbe] Could not locate eligible function "${functionName || ''}" in source.`);
  }

  const activeName = targetFn.getName() || functionName || 'assessedFunction';
  const isAsync = targetFn.isAsync();
  const parameters = extractParameterSpecs(targetFn);
  const boundaryLiterals = extractBoundaryLiterals(targetFn);

  // Synthesize type-safe probe inputs
  const synthesized = synthesizeTypeValidProbeInputs(parameters, boundaryLiterals, isAsync);

  // Execute each probe
  const probes: ExecutedProbe[] = await Promise.all(
    synthesized.map(async (p, idx) => {
      const exec = await executeProbeInSandbox(targetFilePath, activeName, p.inputArgs, cwd);
      const { formatted, isFloat } = formatValueWithFloatTolerance(exec.actualOutput);

      return {
        probeId: `PROBE-${idx + 1}`,
        category: p.category,
        categoryLabel: p.categoryLabel,
        description: p.description,
        inputArgs: p.inputArgs,
        inputArgsJson: JSON.stringify(p.inputArgs),
        actualOutput: exec.actualOutput,
        actualOutputJson: formatted,
        isFloatOutput: isFloat,
        executionMs: exec.executionMs,
        error: exec.error,
      };
    })
  );

  return {
    functionName: activeName,
    filePath: targetFilePath,
    isAsync,
    parameters,
    boundaryLiterals,
    probes,
  };
}
