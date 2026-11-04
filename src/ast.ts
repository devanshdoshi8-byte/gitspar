import { copyFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Project, SyntaxKind, BinaryExpression, FunctionDeclaration, Node } from 'ts-morph';

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

const MUTATION_MAP: Record<string, string> = {
  '>=': '>',
  '>': '>=',
  '<=': '<',
  '<': '<=',
  '===': '!==',
  '!==': '===',
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

    // Check Rule 3: self-contained and deterministic
    if (containsDisallowedSideEffects(fn)) {
      continue;
    }

    // Must have at least one comparison operator
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

export function createBoundaryMutant(
  filePath: string,
  functionName: string,
  tempFilePath: string
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

  const firstComparison = comparisons[0];
  const operatorToken = firstComparison.getOperatorToken();
  const originalOperator = operatorToken.getText();
  const mutatedOperator = MUTATION_MAP[originalOperator];

  if (!mutatedOperator) {
    throw new Error(`Unsupported comparison operator: ${originalOperator}`);
  }

  const originalExpression = firstComparison.getText();
  const left = firstComparison.getLeft().getText();
  const right = firstComparison.getRight().getText();
  const mutatedExpression = `${left} ${mutatedOperator} ${right}`;

  const mutatedLine = operatorToken.getStartLineNumber();

  // Replace operator in AST
  firstComparison.replaceWithText(mutatedExpression);
  sourceFile.saveSync();

  const mutatedFileText = readFileSync(tempFilePath, 'utf-8');
  // Re-read function lines from saved file
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
