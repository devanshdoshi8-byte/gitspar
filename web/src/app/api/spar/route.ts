import { NextResponse } from 'next/server';
import ts from 'typescript';
import vm from 'node:vm';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

interface SparRequestBody {
  action?: 'analyze' | 'sabotage' | 'evaluate' | 'transfer' | 'full';
  code: string;
  functionName?: string;
  oracleArgs: string | unknown[];
  expectedOutput: string | unknown;
  userExplanation?: string;
  transferAnswer?: string;
}

interface MutationCandidate {
  index: number;
  line: number;
  originalOperator: string;
  mutatedOperator: string;
  originalText: string;
  mutatedText: string;
  variableNames: string[];
}

const MUTATION_MAP: Record<string, string> = {
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

function parseArgs(raw: string | unknown[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [raw];
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed.startsWith('[') ? trimmed : `[${trimmed}]`);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [trimmed];
  }
}

function parseExpected(raw: string | unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed !== '') return num;
    return trimmed;
  }
}

function runInSandbox(code: string, functionName: string, args: unknown[]): { success: boolean; result?: unknown; error?: string } {
  try {
    const transpiled = ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText;

    const exportsObj: Record<string, unknown> = {};
    const moduleObj = { exports: exportsObj };

    const sandbox: Record<string, unknown> = {
      exports: exportsObj,
      module: moduleObj,
      args,
      Math,
      Date,
      Number,
      String,
      Boolean,
      Array,
      Object,
      JSON,
      console: { log: () => {} },
      output: undefined,
    };

    const script = new vm.Script(`
      ${transpiled}
      const __targetFn = (typeof ${functionName} === 'function') 
        ? ${functionName} 
        : (exports && typeof exports.${functionName} === 'function') 
          ? exports.${functionName} 
          : (module && module.exports && typeof module.exports.${functionName} === 'function')
            ? module.exports.${functionName}
            : undefined;

      if (typeof __targetFn !== 'function') {
        throw new Error("Function '${functionName}' is not defined or exported.");
      }
      output = __targetFn(...args);
    `);

    const context = vm.createContext(sandbox);
    script.runInContext(context, { timeout: 1500 });

    return { success: true, result: sandbox.output };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

function findFunctionsAndCandidates(code: string, targetFunctionName?: string) {
  const sourceFile = ts.createSourceFile('snippet.ts', code, ts.ScriptTarget.Latest, true);
  const functions: { name: string; signature: string; parameterNames: string[]; line: number }[] = [];
  let matchedFn: ts.FunctionDeclaration | undefined;

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      const params = node.parameters.map((p) => p.name.getText(sourceFile));
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const signature = `${name}(${node.parameters.map((p) => p.getText(sourceFile)).join(', ')})`;
      functions.push({ name, signature, parameterNames: params, line });

      if (!targetFunctionName || name === targetFunctionName) {
        if (!matchedFn) matchedFn = node;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const activeFnName = matchedFn?.name?.text || functions[0]?.name;
  const candidates: MutationCandidate[] = [];

  if (matchedFn) {
    let candidateCount = 0;
    function visitExpr(node: ts.Node) {
      if (ts.isBinaryExpression(node)) {
        const opText = node.operatorToken.getText(sourceFile);
        if (opText in MUTATION_MAP) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.operatorToken.getStart(sourceFile)).line + 1;
          const leftText = node.left.getText(sourceFile);
          const rightText = node.right.getText(sourceFile);
          const mutatedOp = MUTATION_MAP[opText];
          const originalText = node.getText(sourceFile);
          const mutatedText = `${leftText} ${mutatedOp} ${rightText}`;

          const varNames: string[] = [];
          function getVars(n: ts.Node) {
            if (ts.isIdentifier(n)) varNames.push(n.text);
            ts.forEachChild(n, getVars);
          }
          getVars(node);

          candidates.push({
            index: candidateCount++,
            line,
            originalOperator: opText,
            mutatedOperator: mutatedOp,
            originalText,
            mutatedText,
            variableNames: Array.from(new Set(varNames)),
          });
        }
      }
      ts.forEachChild(node, visitExpr);
    }

    if (matchedFn.body) {
      visitExpr(matchedFn.body);
    }
  }

  return { functions, activeFnName, matchedFn, candidates };
}

function mutateCode(code: string, candidate: MutationCandidate): { mutatedCode: string; mutatedLine: number } {
  const sourceFile = ts.createSourceFile('snippet.ts', code, ts.ScriptTarget.Latest, true);
  let mutatedCode = code;

  function visit(node: ts.Node): boolean {
    if (ts.isBinaryExpression(node)) {
      const opText = node.operatorToken.getText(sourceFile);
      const line = sourceFile.getLineAndCharacterOfPosition(node.operatorToken.getStart(sourceFile)).line + 1;
      if (opText === candidate.originalOperator && line === candidate.line) {
        const start = node.operatorToken.getStart(sourceFile);
        const end = node.operatorToken.getEnd();
        mutatedCode = code.slice(0, start) + candidate.mutatedOperator + code.slice(end);
        return true;
      }
    }
    return ts.forEachChild(node, visit) || false;
  }

  visit(sourceFile);
  return { mutatedCode, mutatedLine: candidate.line };
}

export async function POST(req: Request) {
  try {
    const body: SparRequestBody = await req.json();
    const { code, oracleArgs, expectedOutput, userExplanation, transferAnswer } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Source code is required.' }, { status: 400 });
    }

    const parsedArgs = parseArgs(oracleArgs);
    const parsedExpected = parseExpected(expectedOutput);

    // 1. AST Analysis
    const { functions, activeFnName, candidates } = findFunctionsAndCandidates(code, body.functionName);
    if (!activeFnName) {
      return NextResponse.json(
        { error: 'No exported function found in the provided code snippet.' },
        { status: 400 }
      );
    }

    // 2. Baseline Test Execution
    const baseline = runInSandbox(code, activeFnName, parsedArgs);
    if (!baseline.success) {
      return NextResponse.json(
        {
          stage: 'baseline_error',
          error: `Runtime error in baseline code: ${baseline.error}`,
          activeFnName,
        },
        { status: 422 }
      );
    }

    const baselineMatches = JSON.stringify(baseline.result) === JSON.stringify(parsedExpected);

    if (!baselineMatches) {
      return NextResponse.json({
        stage: 'mode_b_real_defect',
        baselinePassed: false,
        actualOutput: baseline.result,
        expectedOutput: parsedExpected,
        message: 'Your baseline code does not produce the expected output for the oracle arguments.',
      });
    }

    // 3. Autonomous SaboteurAgent Retry Loop
    const agentTrace: string[] = [
      `[SaboteurAgent] Discovered ${candidates.length} boundary condition candidate(s) in ${activeFnName}.`,
    ];

    let chosenCandidate: MutationCandidate | null = null;
    let mutatedCode = code;
    let mutantKilled = false;
    let mutantActualOutput: unknown = undefined;

    for (const cand of candidates) {
      agentTrace.push(
        `[SaboteurAgent] Testing Candidate #${cand.index + 1} (Line ${cand.line}: \`${cand.originalText}\` -> \`${cand.mutatedText}\`)...`
      );

      const mutated = mutateCode(code, cand);
      const mutantRun = runInSandbox(mutated.mutatedCode, activeFnName, parsedArgs);

      const isKilled = !mutantRun.success || JSON.stringify(mutantRun.result) !== JSON.stringify(parsedExpected);

      if (isKilled) {
        chosenCandidate = cand;
        mutatedCode = mutated.mutatedCode;
        mutantKilled = true;
        mutantActualOutput = mutantRun.result;
        agentTrace.push(
          `[SaboteurAgent] ✅ Candidate #${cand.index + 1} on Line ${cand.line} KILLED (Oracle test turned RED). Output changed from ${JSON.stringify(
            parsedExpected
          )} to ${JSON.stringify(mutantRun.result)}.`
        );
        break;
      } else {
        agentTrace.push(
          `[SaboteurAgent] ⚠️ Candidate #${cand.index + 1} SURVIVED oracle input (produced ${JSON.stringify(
            mutantRun.result
          )}). Backtracking...`
        );
      }
    }

    if (!chosenCandidate && candidates.length > 0) {
      chosenCandidate = candidates[0];
      const fallbackMutated = mutateCode(code, chosenCandidate);
      mutatedCode = fallbackMutated.mutatedCode;
      agentTrace.push(
        `[SaboteurAgent] All candidates survived. Defaulted to candidate #${chosenCandidate.index + 1} on Line ${chosenCandidate.line} for interactive boundary probe.`
      );
    }

    // 4. Socratic Evaluation (if explanation supplied)
    let socraticEvaluation = null;
    if (userExplanation && chosenCandidate) {
      const lower = userExplanation.toLowerCase();
      const vars = chosenCandidate.variableNames.map((v) => v.toLowerCase());
      const mentionsVar = vars.some((v) => lower.includes(v)) || lower.includes('input') || lower.includes('parameter') || lower.includes('variable');
      const mentionsOp = [chosenCandidate.mutatedOperator, 'operator', 'boundary', 'threshold', 'equal', 'greater', 'less', 'strict'].some((k) => lower.includes(k));
      const mentionsCausal = ['because', 'caused', 'when', 'since', 'due to', 'evaluated', 'resulted', 'returned', 'instead of'].some((k) => lower.includes(k));

      const isTrivial = lower.length < 20 || lower.includes('i fixed the bug') || lower.includes('fixed it');

      if (isTrivial || (!mentionsOp && !mentionsCausal)) {
        socraticEvaluation = {
          approved: false,
          score: 35,
          socraticPrompt: `Your fix passed the test, but your explanation didn't explain how mutating "${chosenCandidate.originalOperator}" to "${chosenCandidate.mutatedOperator}" affected the boundary value ${JSON.stringify(
            parsedArgs
          )}. Briefly explain the causal boundary failure:`,
        };
      } else {
        socraticEvaluation = {
          approved: true,
          score: 92,
          feedback: 'Verified diagnostic proof. Explanation articulates causal operator mutation mechanism.',
        };
      }
    }

    // 5. Transfer Probe Synthesis (Unseen Counterfactual Input)
    const probeInput = parsedArgs.map((arg) => {
      if (typeof arg === 'number') return arg === 0 ? 1 : arg + 1;
      if (typeof arg === 'boolean') return !arg;
      if (typeof arg === 'string') return arg + '_alt';
      return arg;
    });

    const transferGroundTruth = runInSandbox(code, activeFnName, probeInput);
    let transferCheckPassed: boolean | undefined = undefined;

    if (transferAnswer !== undefined && transferGroundTruth.success) {
      const trimmedAns = String(transferAnswer).trim();
      const expectedStr = JSON.stringify(transferGroundTruth.result);
      transferCheckPassed =
        trimmedAns === String(transferGroundTruth.result) ||
        JSON.stringify(parseExpected(trimmedAns)) === expectedStr;
    }

    // 6. Cryptographic Diff Fingerprint
    const workingDiffSha256 = crypto.createHash('sha256').update(code).digest('hex');

    return NextResponse.json({
      success: true,
      activeFnName,
      availableFunctions: functions,
      baselinePassed: true,
      baselineOutput: baseline.result,
      mutantKilled,
      mutantActualOutput,
      candidate: chosenCandidate,
      mutatedCode,
      agentTrace,
      socraticEvaluation,
      transferProbe: {
        probeInput,
        groundTruth: transferGroundTruth.result,
        transferCheckPassed,
      },
      receipt: {
        timestamp: new Date().toISOString(),
        working_diff_sha256: workingDiffSha256,
        function_name: activeFnName,
        oracle_input: parsedArgs,
        oracle_expected_output: parsedExpected,
        mutated_line: chosenCandidate?.line ?? null,
        mutated_operator: chosenCandidate?.mutatedOperator ?? null,
        transfer_check_passed: transferCheckPassed,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
