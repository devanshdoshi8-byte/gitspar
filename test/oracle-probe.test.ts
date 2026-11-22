import { describe, it, expect, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import {
  extractParameterSpecs,
  extractBoundaryLiterals,
  synthesizeTypeValidProbeInputs,
  formatValueWithFloatTolerance,
  probeHighRiskFunction,
  ExecutedProbe,
} from '../src/oracle-probe.js';
import {
  generateVitestRegressionSuite,
  generatePrContractMarkdown,
  compileAndSaveContract,
  HumanVerdictDecision,
} from '../src/contract-compiler.js';

describe('Executable Intent Contracts & JiT-Oracle Engine', () => {
  const examplePath = resolve(process.cwd(), 'examples/checkoutDiscount.ts');
  const tempTestFilePath = resolve(process.cwd(), 'examples/checkoutDiscount.spar.test.ts');

  afterAll(() => {
    if (existsSync(tempTestFilePath)) {
      try {
        rmSync(tempTestFilePath, { force: true });
      } catch {}
    }
  });

  it('probes high-risk function and synthesizes type-valid edge-case vectors', async () => {
    const result = await probeHighRiskFunction(examplePath, 'calculateTierDiscount');

    expect(result.functionName).toBe('calculateTierDiscount');
    expect(result.parameters.length).toBe(2);
    expect(result.parameters[0].name).toBe('orderTotal');
    expect(result.parameters[0].baseType).toBe('number');
    expect(result.parameters[1].name).toBe('isStudent');
    expect(result.parameters[1].baseType).toBe('boolean');

    // Should detect the relational boundary literal (100)
    expect(result.boundaryLiterals).toContain(100);

    // Should generate 3 high-signal probe categories
    expect(result.probes.length).toBe(3);
    const categories = result.probes.map((p) => p.category);
    expect(categories).toContain('boundary_threshold');
    expect(categories).toContain('zero_empty_nullish');
    expect(categories).toContain('floating_point_precision');

    // Verify exact boundary probe execution
    const boundaryProbe = result.probes.find((p) => p.category === 'boundary_threshold')!;
    expect(boundaryProbe.inputArgs[0]).toBe(100);
    expect(boundaryProbe.actualOutput).toBe(90);
  });

  it('applies IEEE-754 floating point tolerance correctly', () => {
    const floatVal = 80.80000000000001;
    const { formatted, isFloat } = formatValueWithFloatTolerance(floatVal);
    expect(isFloat).toBe(true);
    expect(formatted).toBe('80.8');

    const intVal = 100;
    const intRes = formatValueWithFloatTolerance(intVal);
    expect(intRes.isFloat).toBe(false);
    expect(intRes.formatted).toBe('100');
  });

  it('generates clean Vitest regression suite with [INTENDED] assertions and [DEFECT] it.fails guards', () => {
    const mockProbes: ExecutedProbe[] = [
      {
        probeId: 'PROBE-1',
        category: 'boundary_threshold',
        categoryLabel: 'Exact Boundary Threshold',
        description: 'orderTotal = 100 threshold discount',
        inputArgs: [100, false],
        inputArgsJson: '[100, false]',
        actualOutput: 90,
        actualOutputJson: '90',
        isFloatOutput: false,
        executionMs: 1.2,
      },
      {
        probeId: 'PROBE-2',
        category: 'floating_point_precision',
        categoryLabel: 'Floating-Point Precision',
        description: 'student discount on 101 order total',
        inputArgs: [101, true],
        inputArgsJson: '[101, true]',
        actualOutput: 80.8,
        actualOutputJson: '80.8',
        isFloatOutput: true,
        executionMs: 0.9,
      },
    ];

    const decisions: HumanVerdictDecision[] = [
      {
        probe: mockProbes[0],
        verdict: 'INTENDED',
        intentNote: 'Tier discount starts at exactly 100',
      },
      {
        probe: mockProbes[1],
        verdict: 'DEFECT',
        expectedOutput: 80.8,
        intentNote: 'Penny rounding defect: must round to 2 decimal places',
      },
    ];

    const testContent = generateVitestRegressionSuite({
      functionName: 'calculateTierDiscount',
      sourceFilePath: 'examples/checkoutDiscount.ts',
      decisions,
    });

    expect(testContent).toContain("import { describe, it, expect } from 'vitest';");
    expect(testContent).toContain("import { calculateTierDiscount } from './checkoutDiscount.js';");
    expect(testContent).toContain("it('contract #1 [INTENDED]: Tier discount starts at exactly 100'");
    expect(testContent).toContain("expect(result).toEqual(90);");
    expect(testContent).toContain("it.fails('contract #2 [DEFECT]: Penny rounding defect");
  });

  it('generates Markdown PR Contract table matching specification', () => {
    const mockProbe: ExecutedProbe = {
      probeId: 'PROBE-1',
      category: 'boundary_threshold',
      categoryLabel: 'Exact Boundary Threshold',
      description: 'orderTotal = 100',
      inputArgs: [100, false],
      inputArgsJson: '[100, false]',
      actualOutput: 90,
      actualOutputJson: '90',
      isFloatOutput: false,
      executionMs: 0.8,
    };

    const decisions: HumanVerdictDecision[] = [
      {
        probe: mockProbe,
        verdict: 'INTENDED',
        intentNote: 'Volume discount tier begins at 100',
      },
    ];

    const markdown = generatePrContractMarkdown({
      functionName: 'calculateTierDiscount',
      sourceFilePath: 'examples/checkoutDiscount.ts',
      decisions,
    });

    expect(markdown).toContain('### 🛡️ GitSpar Verified Intent Contract (`calculateTierDiscount`)');
    expect(markdown).toContain('| Edge Case Category | Input Arguments | Observed Output | Owner Verdict | Intent Specification |');
    expect(markdown).toContain('✅ **INTENDED**');
    expect(markdown).toContain('`[100,false]`');
    expect(markdown).toContain('Volume discount tier begins at 100');
  });

  it('compileAndSaveContract writes .spar.test.ts to disk and verifies output', () => {
    const mockProbe: ExecutedProbe = {
      probeId: 'PROBE-1',
      category: 'boundary_threshold',
      categoryLabel: 'Exact Boundary Threshold',
      description: 'boundary test',
      inputArgs: [100, false],
      inputArgsJson: '[100, false]',
      actualOutput: 90,
      actualOutputJson: '90',
      isFloatOutput: false,
      executionMs: 1.0,
    };

    const result = compileAndSaveContract({
      functionName: 'calculateTierDiscount',
      sourceFilePath: 'examples/checkoutDiscount.ts',
      decisions: [
        {
          probe: mockProbe,
          verdict: 'INTENDED',
          intentNote: 'Confirmed by human owner',
        },
      ],
    });

    expect(existsSync(result.testFilePath)).toBe(true);
    expect(result.summary.totalProbes).toBe(1);
    expect(result.summary.intendedCount).toBe(1);
    expect(result.summary.defectCount).toBe(0);

    const fileText = readFileSync(result.testFilePath, 'utf-8');
    expect(fileText).toContain('Intent Contract Regression Suite: calculateTierDiscount()');

    // Clean up
    rmSync(result.testFilePath, { force: true });
  });
});
