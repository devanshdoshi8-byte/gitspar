import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

export interface TestResult {
  passed: boolean;
  rawOutput: string;
}

export function runIsolatedVitestCheck(
  targetModulePath: string,
  functionName: string,
  argsJson: string,
  expectedReturnJson: string,
  cwd: string = process.cwd()
): TestResult {
  const tempDir = resolve(cwd, '.diffproof/temp');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const testFilePath = resolve(tempDir, 'oracle.test.ts');
  const absTargetPath = resolve(cwd, targetModulePath);

  let importRelPath = relative(tempDir, absTargetPath).replace(/\\/g, '/');
  if (!importRelPath.startsWith('.')) {
    importRelPath = './' + importRelPath;
  }

  // Generate oracle test spec
  const testContent = `import { describe, it, expect } from 'vitest';
import { ${functionName} } from '${importRelPath}';

describe('Independent Oracle Check', () => {
  it('matches user-specified behavioral expectation', () => {
    const args = ${argsJson};
    const expected = ${expectedReturnJson};
    expect(${functionName}(...(args as any))).toEqual(expected);
  });
});
`;

  writeFileSync(testFilePath, testContent, 'utf-8');

  const normalizedTestRelPath = relative(cwd, testFilePath).replace(/\\/g, '/');
  const command = `npx vitest run ${normalizedTestRelPath} --reporter=basic`;

  try {
    const stdout = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
      },
    });

    return {
      passed: true,
      rawOutput: stdout,
    };
  } catch (err: unknown) {
    const errorWithOutput = err as { stdout?: string; stderr?: string; message?: string };
    const output = (errorWithOutput.stdout || '') + '\n' + (errorWithOutput.stderr || errorWithOutput.message || '');
    return {
      passed: false,
      rawOutput: output.trim(),
    };
  }
}
