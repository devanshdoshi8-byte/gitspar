import { copyFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Project, SyntaxKind, BinaryExpression, FunctionDeclaration } from 'ts-morph';

export interface EligibleFunction {
  filePath: string;
  functionName: string;
  signature: string;
  parameterNames: string[];
  startLine: number;
  endLine: number;
  fullFunctionCodeWithLines: string;
}

export interface MutationResult {
  mutatedLine: number;
  originalOperator: string;
  mutatedOperator: string;
  originalExpression: string;
  mutatedExpression: string;
  mutatedFunctionCode: string;
}

export interface MutationCandidate {
  index: number;
  line: number;
  originalOperator: string;
  mutatedOperator: string;
  originalExpression: string;
  mutatedExpression: string;
  variableNames: string[];
  complexityScore: number;
}

export const MUTATION_MAP: Record<string, string> = {
  '>=': '>',
  '>': '>=',
  '<=': '<',
  '<': '<=',
  '===': '!==',
  '!==': '===',
  '==': '!=',
  '!=': '==',
  '+': '-',
  '-': '+',
};

const DISALLOWED_IDENTIFIERS = ['fetch', 'process', 'db', 'prisma', 'supabase', 'typeorm', 'knex', 'pool'];

function formatCodeWithLineNumbers(fileText: string, startLine: number, endLine: number): string {
  const lines = fileText.split(/\r?\n/);
  const selectedLines = lines.slice(startLine - 1, endLine);
  const padLength = String(endLine).length;

  return selectedLines
    .map((line, index) => {
      const lineNum = String(startLine + index).padStart(padLength, ' ');
      return `  ${lineNum} | ${line}`;
    })
    .join('\n');
}

function containsDisallowedSideEffects(fn: FunctionDeclaration): boolean {
  const body = fn.getBody();
  if (!body) return true;

  const bodyText = body.getText();
  if (bodyText.includes('process.env')) {
    return true;
  }

  const identifiers = body.getDescendantsOfKind(SyntaxKind.Identifier);
  for (const id of identifiers) {
    if (DISALLOWED_IDENTIFIERS.includes(id.getText())) {
      return true;
    }
  }

  return false;
}

function findComparisonExpressions(fn: FunctionDeclaration): BinaryExpression[] {
  const binaryExpressions = fn.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  return binaryExpressions.filter((expr) => {
    const opToken = expr.getOperatorToken().getText();
    return opToken in MUTATION_MAP;
  });
}

function calculateComplexityScore(op: string, leftText: string, rightText: string): number {
  let score = 50;
  if (['>=', '<=', '>', '<'].includes(op)) score += 50; // Relational boundary checks highest
  else if (['===', '!==', '==', '!='].includes(op)) score += 30; // Equality checks
  else if (['+', '-', '*', '/'].includes(op)) score += 10; // Arithmetic

  // Bonus if comparing against numeric literal (classic boundary)
  if (/\d+/.test(leftText) || /\d+/.test(rightText)) score += 15;
  // Bonus if identifiers are involved on both sides
  if (/[a-zA-Z_$]/.test(leftText) && /[a-zA-Z_$]/.test(rightText)) score += 10;
  return score;
}

export function discoverEligibleFunctions(filePath: string): EligibleFunction[] {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  });

  const sourceFile = project.addSourceFileAtPath(filePath);
  const fileText = sourceFile.getFullText();
  const functions = sourceFile.getFunctions();

  const eligibleList: EligibleFunction[] = [];

  for (const fn of functions) {
    if (!fn.isExported()) {
      continue;
    }

    const name = fn.getName();
    if (!name) {
      continue;
    }

    const params = fn.getParameters();
    if (params.length === 0) {
      continue;
    }

    if (containsDisallowedSideEffects(fn)) {
      continue;
    }

    const comparisons = findComparisonExpressions(fn);
    if (comparisons.length === 0) {
      continue;
    }

    const parameterNames = params.map((p) => p.getName());
    const paramsFormatted = params.map((p) => p.getText()).join(', ');
    const returnTypeNode = fn.getReturnTypeNode();
    const returnTypeStr = returnTypeNode ? returnTypeNode.getText() : fn.getReturnType().getText();
    const signature = `${name}(${paramsFormatted}): ${returnTypeStr}`;

    const startLine = fn.getStartLineNumber();
    const endLine = fn.getEndLineNumber();
    const fullFunctionCodeWithLines = formatCodeWithLineNumbers(fileText, startLine, endLine);

    eligibleList.push({
      filePath,
      functionName: name,
      signature,
      parameterNames,
      startLine,
      endLine,
      fullFunctionCodeWithLines,
    });
  }

  return eligibleList;
}

export function discoverAllMutationCandidates(filePath: string, functionName: string): MutationCandidate[] {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  });

  const sourceFile = project.addSourceFileAtPath(filePath);
  const fn = sourceFile.getFunction(functionName);

  if (!fn) {
    throw new Error(`Exported function "${functionName}" not found in ${filePath}`);
  }

  const comparisons = findComparisonExpressions(fn);
  const candidates: MutationCandidate[] = comparisons.map((expr, i) => {
    const operatorToken = expr.getOperatorToken();
    const originalOperator = operatorToken.getText();
    const mutatedOperator = MUTATION_MAP[originalOperator] || '!==';
    const leftText = expr.getLeft().getText();
    const rightText = expr.getRight().getText();
    const originalExpression = expr.getText();
    const mutatedExpression = `${leftText} ${mutatedOperator} ${rightText}`;
    const line = operatorToken.getStartLineNumber();
    const varNames = expr.getDescendantsOfKind(SyntaxKind.Identifier).map((id) => id.getText());
    const complexityScore = calculateComplexityScore(originalOperator, leftText, rightText);

    return {
      index: i,
      line,
      originalOperator,
      mutatedOperator,
      originalExpression,
      mutatedExpression,
      variableNames: Array.from(new Set(varNames)),
      complexityScore,
    };
  });

  // Rank by complexity score descending, then by line number
  candidates.sort((a, b) => {
    if (b.complexityScore !== a.complexityScore) {
      return b.complexityScore - a.complexityScore;
    }
    return a.line - b.line;
  });

  // Re-index according to rank
  return candidates.map((c, idx) => ({ ...c, index: idx }));
}

export function createBoundaryMutant(
  filePath: string,
  functionName: string,
  tempFilePath: string,
  candidateIndex: number = 0
): MutationResult {
  const tempDir = dirname(tempFilePath);
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  copyFileSync(filePath, tempFilePath);

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  });

  const sourceFile = project.addSourceFileAtPath(tempFilePath);
  const fn = sourceFile.getFunction(functionName);

  if (!fn) {
    throw new Error(`Exported function "${functionName}" not found in ${filePath}`);
  }

  const comparisons = findComparisonExpressions(fn);
  if (comparisons.length === 0) {
    throw new Error(`Function "${functionName}" does not contain any mutable comparison operators.`);
  }

  const selectedIdx = candidateIndex >= 0 && candidateIndex < comparisons.length ? candidateIndex : 0;
  const targetComparison = comparisons[selectedIdx];
  const operatorToken = targetComparison.getOperatorToken();
  const originalOperator = operatorToken.getText();
  const mutatedOperator = MUTATION_MAP[originalOperator];

  if (!mutatedOperator) {
    throw new Error(`Unsupported comparison operator: ${originalOperator}`);
  }

  const originalExpression = targetComparison.getText();
  const left = targetComparison.getLeft().getText();
  const right = targetComparison.getRight().getText();
  const mutatedExpression = `${left} ${mutatedOperator} ${right}`;

  const mutatedLine = operatorToken.getStartLineNumber();

  targetComparison.replaceWithText(mutatedExpression);
  sourceFile.saveSync();

  const mutatedFileText = readFileSync(tempFilePath, 'utf-8');
  const projectReloaded = new Project({ skipAddingFilesFromTsConfig: true });
  const reloadedFile = projectReloaded.addSourceFileAtPath(tempFilePath);
  const reloadedFn = reloadedFile.getFunction(functionName);
  const startLine = reloadedFn ? reloadedFn.getStartLineNumber() : fn.getStartLineNumber();
  const endLine = reloadedFn ? reloadedFn.getEndLineNumber() : fn.getEndLineNumber();
  const mutatedFunctionCode = formatCodeWithLineNumbers(mutatedFileText, startLine, endLine);

  return {
    mutatedLine,
    originalOperator,
    mutatedOperator,
    originalExpression,
    mutatedExpression,
    mutatedFunctionCode,
  };
}

export function createBoundaryMutantFromCode(
  code: string,
  functionName: string,
  candidateIndex: number = 0
): MutationResult {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('snippet.ts', code);
  const fn = sourceFile.getFunction(functionName);

  if (!fn) {
    throw new Error(`Exported function "${functionName}" not found in code snippet.`);
  }

  const comparisons = findComparisonExpressions(fn);
  if (comparisons.length === 0) {
    throw new Error(`Function "${functionName}" does not contain any mutable comparison operators.`);
  }

  const selectedIdx = candidateIndex >= 0 && candidateIndex < comparisons.length ? candidateIndex : 0;
  const targetComparison = comparisons[selectedIdx];
  const operatorToken = targetComparison.getOperatorToken();
  const originalOperator = operatorToken.getText();
  const mutatedOperator = MUTATION_MAP[originalOperator];

  if (!mutatedOperator) {
    throw new Error(`Unsupported comparison operator: ${originalOperator}`);
  }

  const originalExpression = targetComparison.getText();
  const left = targetComparison.getLeft().getText();
  const right = targetComparison.getRight().getText();
  const mutatedExpression = `${left} ${mutatedOperator} ${right}`;
  const mutatedLine = operatorToken.getStartLineNumber();

  targetComparison.replaceWithText(mutatedExpression);

  const mutatedText = sourceFile.getFullText();
  const startLine = fn.getStartLineNumber();
  const endLine = fn.getEndLineNumber();
  const mutatedFunctionCode = formatCodeWithLineNumbers(mutatedText, startLine, endLine);

  return {
    mutatedLine,
    originalOperator,
    mutatedOperator,
    originalExpression,
    mutatedExpression,
    mutatedFunctionCode,
  };
}
