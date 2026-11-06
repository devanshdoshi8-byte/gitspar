import { describe, it, expect, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { discoverEligibleFunctions, createBoundaryMutant, discoverAllMutationCandidates } from '../src/ast.js';
import { runIsolatedVitestCheck } from '../src/runner.js';
import { getRepoContext, resolveBaseRef } from '../src/git.js';
import { saveReceipt, AssessmentReceipt } from '../src/receipt.js';
import { runCiCheck } from '../src/cli.js';
import { loadGitSparConfig } from '../src/config.js';
import { SaboteurAgent, SocraticEvaluatorAgent, TransferProbeAgent } from '../src/agent.js';

describe('GitSpar v0.3.0 End-to-End Engine & CI Verification', () => {
  const examplePath = resolve(process.cwd(), 'examples/checkoutDiscount.ts');
  const tempMutantPath = resolve(process.cwd(), '.gitspar/temp/test-mutant.ts');

  afterAll(() => {
    const tempDir = resolve(process.cwd(), '.gitspar/temp');
    if (existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('RULE 1 & 3: discoverEligibleFunctions extracts blind signature without body', () => {
    const funcs = discoverEligibleFunctions(examplePath);
    expect(funcs.length).toBe(1);

    const fn = funcs[0];
    expect(fn.functionName).toBe('calculateTierDiscount');
    expect(fn.signature).toBe('calculateTierDiscount(orderTotal: number, isStudent: boolean): number');
    expect(fn.parameterNames).toEqual(['orderTotal', 'isStudent']);
    expect(fn.startLine).toBe(1);
    expect(fn.endLine).toBe(6);
  });

  it('RULE 2: createBoundaryMutant flips >= to > on line 2', () => {
    const mutation = createBoundaryMutant(examplePath, 'calculateTierDiscount', tempMutantPath);

    expect(mutation.mutatedLine).toBe(2);
    expect(mutation.originalOperator).toBe('>=');
    expect(mutation.mutatedOperator).toBe('>');
    expect(mutation.originalExpression).toContain('orderTotal >= 100');
    expect(mutation.mutatedExpression).toBe('orderTotal > 100');
  });

  it('RULE 1 & 2: Independent Oracle executes unmodified function (GREEN) and mutant (RED)', () => {
    const argsJson = '[100, false]';
    const expectedJson = '90';

    // 1. Unmodified function passes (GREEN)
    const baseline = runIsolatedVitestCheck(
      examplePath,
      'calculateTierDiscount',
      argsJson,
      expectedJson
    );
    expect(baseline.passed).toBe(true);

    // 2. Mutated copy fails (RED, kills mutant)
    const mutantCheck = runIsolatedVitestCheck(
      tempMutantPath,
      'calculateTierDiscount',
      argsJson,
      expectedJson
    );
    expect(mutantCheck.passed).toBe(false);
    expect(mutantCheck.rawOutput).toContain('100');
  });

  it('RULE 4: Git working-tree context computes baseCommitSha and workingDiffSha256', () => {
    const context = getRepoContext(process.cwd());
    expect(context.baseCommitSha).not.toBe('UNCOMMITTED_INIT');
    expect(context.baseCommitSha.length).toBeGreaterThanOrEqual(7);
    expect(context.workingDiffSha256).toHaveLength(64);
  });

  it('RULE 5: Receipt generation writes receipt.json and PR_RECEIPT.md in .gitspar/', () => {
    const testDir = resolve(process.cwd(), '.gitspar/test-receipt');
    const mockReceipt: AssessmentReceipt = {
      timestamp: new Date().toISOString(),
      base_commit_sha: 'aa31e5e',
      working_diff_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      mode: 'mutation_drill',
      language: 'typescript',
      target_file: 'examples/checkoutDiscount.ts',
      function_name: 'calculateTierDiscount',
      oracle_source: 'user_specified_blind_assertion',
      oracle_input: [100, false],
      oracle_expected_output: 90,
      mutation_operator: '>',
      baseline_test: 'passed',
      mutation_test: 'failed',
      repair_test: 'passed',
      diagnosed_line: 2,
      explanation: 'Boundary operator flipped >= to > so orderTotal of 100 was not discounted.',
    };

    const saved = saveReceipt(mockReceipt, testDir);
    expect(existsSync(saved.jsonPath)).toBe(true);
    expect(existsSync(saved.markdownPath)).toBe(true);

    const mdContent = readFileSync(saved.markdownPath, 'utf-8');
    expect(mdContent).toContain('GitSpar Verification Receipt');
    expect(mdContent).toContain('GitSpar v0.3.0');

    // Clean up test receipt dir
    rmSync(testDir, { recursive: true, force: true });
  });

  it('CI Mode: resolveBaseRef resolves a viable comparison base ref', () => {
    const baseRef = resolveBaseRef(process.cwd());
    expect(typeof baseRef).toBe('string');
    expect(baseRef.length).toBeGreaterThan(0);
  });

  it('CI Mode: runCiCheck returns 0 (PASS) when a valid receipt exists', async () => {
    const code = await runCiCheck(process.cwd());
    expect(code).toBe(0);
  });

  it('Agentic Loop: SaboteurAgent executes autonomous mutant-kill retry loop with reasoning trace', async () => {
    const saboteur = new SaboteurAgent(process.cwd());
    const candidates = discoverAllMutationCandidates(examplePath, 'calculateTierDiscount');
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].originalOperator).toBe('>=');

    const result = await saboteur.findKillingMutant(
      examplePath,
      'calculateTierDiscount',
      '[100, false]',
      '90',
      tempMutantPath
    );

    expect(result.killingMutant.mutatedLine).toBe(2);
    expect(result.mutantKilled).toBe(true);
    expect(result.agentTrace.length).toBeGreaterThanOrEqual(2);
    expect(result.agentTrace.some((t) => t.includes('KILLED'))).toBe(true);
  });

  it('Agentic Loop: SocraticEvaluatorAgent rejects vague explanations and accepts causal boundary proofs', async () => {
    const evaluator = new SocraticEvaluatorAgent();

    // 1. Vague explanation rejected
    const vagueEval = await evaluator.evaluateExplanation({
      explanation: 'I fixed the bug',
      functionName: 'calculateTierDiscount',
      originalExpression: 'orderTotal >= 100',
      mutatedExpression: 'orderTotal > 100',
      mutatedLine: 2,
      mutatedOperator: '>',
      oracleInput: [100, false],
      oracleExpectedOutput: 90,
      variableNames: ['orderTotal', 'isStudent'],
    });

    expect(vagueEval.approved).toBe(false);
    expect(vagueEval.score).toBeLessThan(50);
    expect(vagueEval.socraticPrompt).toBeDefined();

    // 2. Clear causal explanation approved
    const goodEval = await evaluator.evaluateExplanation({
      explanation:
        'The boundary condition was mutated from >= to > which caused orderTotal of 100 to evaluate false and return full price instead of 90.',
      functionName: 'calculateTierDiscount',
      originalExpression: 'orderTotal >= 100',
      mutatedExpression: 'orderTotal > 100',
      mutatedLine: 2,
      mutatedOperator: '>',
      oracleInput: [100, false],
      oracleExpectedOutput: 90,
      variableNames: ['orderTotal', 'isStudent'],
    });

    expect(goodEval.approved).toBe(true);
    expect(goodEval.score).toBeGreaterThanOrEqual(70);
    expect(goodEval.feedback).toBeDefined();
  });

  it('Agentic Loop: TransferProbeAgent synthesizes counterfactual inputs and computes ground truth', () => {
    const transfer = new TransferProbeAgent(process.cwd());

    // 1. Synthesize counterfactual probe
    const probe = transfer.synthesizeProbe([100, false], 'calculateTierDiscount');
    expect(probe.probeInput).toEqual([101, true]);
    expect(probe.reasoning).toContain('100,false');

    // 2. Compute ground-truth execution
    const groundTruth = transfer.computeGroundTruth(examplePath, 'calculateTierDiscount', [100, true]);
    expect(groundTruth).toBe(80); // Student discount: 100 * 0.8 = 80

    // 3. User answer validation
    expect(transfer.evaluateUserAnswer('80', 80)).toBe(true);
    expect(transfer.evaluateUserAnswer('90', 80)).toBe(false);
  });
});
