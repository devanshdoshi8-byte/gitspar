import { describe, it, expect, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { discoverEligibleFunctions, createBoundaryMutant } from '../src/ast.js';
import { runIsolatedVitestCheck } from '../src/runner.js';
import { getRepoContext } from '../src/git.js';
import { saveReceipt, AssessmentReceipt } from '../src/receipt.js';

describe('DiffProof v0.1 End-to-End Engine Verification', () => {
  const examplePath = resolve(process.cwd(), 'examples/checkoutDiscount.ts');
  const tempMutantPath = resolve(process.cwd(), '.diffproof/temp/test-mutant.ts');

  afterAll(() => {
    const tempDir = resolve(process.cwd(), '.diffproof/temp');
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

  it('RULE 5: Receipt generation writes receipt.json and PR_RECEIPT.md', () => {
    const testDir = resolve(process.cwd(), '.diffproof/test-receipt');
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

    // Clean up test receipt dir
    rmSync(testDir, { recursive: true, force: true });
  });
});
