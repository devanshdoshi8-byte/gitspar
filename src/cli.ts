#!/usr/bin/env node
import * as readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { resolve, relative } from 'node:path';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import {
  getRepoContext,
  resolveBaseRef,
  refExists,
  computeDiffHashForRef,
  computeDiffHashForTarget,
} from './git.js';
import { discoverEligibleFunctions, createBoundaryMutant, EligibleFunction, MutationResult } from './ast.js';
import { runIsolatedVitestCheck } from './runner.js';
import { saveReceipt, AssessmentReceipt } from './receipt.js';
import { loadGitSparConfig } from './config.js';
import { SaboteurAgent, SocraticEvaluatorAgent, TransferProbeAgent } from './agent.js';

// ANSI styling helpers (Rule 5: Zero-conflict, no chalk/inquirer)
const reset = '\x1b[0m';
const bold = '\x1b[1m';
const dim = '\x1b[2m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const cyan = '\x1b[36m';
const magenta = '\x1b[35m';

function printHeader() {
  console.log(`\n${bold}${cyan}╔═══════════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${bold}${cyan}║                      GitSpar (v0.3.0)                             ║${reset}`);
  console.log(`${bold}${cyan}║         Verified Change Understanding Assessment CLI              ║${reset}`);
  console.log(`${bold}${cyan}╚═══════════════════════════════════════════════════════════════════╝${reset}\n`);
}

/**
 * Universal prompt interface using node:readline.
 * Supports both interactive terminal (TTY) and piped input (tests, scripts).
 */
export class PromptInterface {
  private rl: readline.Interface;
  private queuedLines: string[] = [];
  private resolvers: ((line: string) => void)[] = [];
  private isClosed = false;

  constructor() {
    this.rl = readline.createInterface({
      input,
      output,
      terminal: input.isTTY ?? false,
    });

    this.rl.on('line', (line) => {
      if (this.resolvers.length > 0) {
        const resolveFn = this.resolvers.shift()!;
        resolveFn(line);
      } else {
        this.queuedLines.push(line);
      }
    });

    this.rl.on('close', () => {
      this.isClosed = true;
      while (this.resolvers.length > 0) {
        const resolveFn = this.resolvers.shift()!;
        resolveFn('');
      }
    });
  }

  async question(promptText: string): Promise<string> {
    output.write(promptText);

    if (this.queuedLines.length > 0) {
      const line = this.queuedLines.shift()!;
      if (!input.isTTY) {
        output.write(line + '\n');
      }
      return line;
    }

    if (this.isClosed) {
      return '';
    }

    return new Promise<string>((resolve) => {
      this.resolvers.push((line) => {
        if (!input.isTTY) {
          output.write(line + '\n');
        }
        resolve(line);
      });
    });
  }

  close() {
    this.rl.close();
  }
}

/**
 * Smart input parser for the Blind Oracle arguments.
 * Auto-formats comma-separated inputs (e.g. `100, false`) into a valid JSON array (`[100, false]`)
 * with clear inline feedback.
 */
async function promptOracleArguments(
  prompt: PromptInterface,
  promptText: string
): Promise<{ raw: string; parsed: unknown[] }> {
  while (true) {
    const raw = (await prompt.question(promptText)).trim();
    if (!raw) {
      console.log(`${red}❌ Input cannot be empty. Enter values like [100, false] or 100, false.${reset}`);
      continue;
    }

    let candidate = raw;
    let autoFormatted = false;

    // If user omitted surrounding brackets, attempt auto-formatting
    if (!candidate.startsWith('[') || !candidate.endsWith(']')) {
      const bracketed = `[${candidate}]`;
      try {
        const testParsed = JSON.parse(bracketed);
        if (Array.isArray(testParsed)) {
          candidate = bracketed;
          autoFormatted = true;
        }
      } catch {
        // Attempt quoting unquoted tokens if comma-separated words were passed
        try {
          const tokens = candidate.split(',').map((t) => t.trim());
          const quoted = tokens.map((t) => {
            if (/^(?:true|false|null|-?\d+(?:\.\d+)?)$/.test(t) || (t.startsWith('"') && t.endsWith('"'))) {
              return t;
            }
            return JSON.stringify(t);
          });
          const wrapped = `[${quoted.join(', ')}]`;
          const testParsed = JSON.parse(wrapped);
          if (Array.isArray(testParsed)) {
            candidate = wrapped;
            autoFormatted = true;
          }
        } catch {}
      }
    }

    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        if (autoFormatted) {
          console.log(`${dim}💡 Auto-formatted input to JSON array: ${cyan}${candidate}${reset}`);
        }
        return { raw: candidate, parsed };
      }
      console.log(`${red}❌ Input must be arguments matching parameters (e.g. [100, false] or 100, false).${reset}`);
    } catch {
      console.log(`${red}❌ Could not parse input as arguments. Enter values like [100, false] or 100, false.${reset}`);
    }
  }
}

async function promptValidJson<T>(
  prompt: PromptInterface,
  promptText: string,
  validator: (parsed: unknown) => { valid: boolean; error?: string }
): Promise<{ raw: string; parsed: T }> {
  while (true) {
    const raw = (await prompt.question(promptText)).trim();
    try {
      const parsed = JSON.parse(raw);
      const check = validator(parsed);
      if (check.valid) {
        return { raw, parsed: parsed as T };
      }
      console.log(`${red}❌ ${check.error || 'Invalid input.'}${reset}`);
    } catch {
      // If user typed a plain string or primitive without surrounding quotes
      try {
        const parsed = JSON.parse(`"${raw}"`);
        const check = validator(parsed);
        if (check.valid) {
          return { raw: JSON.stringify(raw), parsed: parsed as T };
        }
      } catch {}
      console.log(`${red}❌ Please enter a valid JSON value (e.g. 90, true, "string").${reset}`);
    }
  }
}

/**
 * Non-Interactive / CI Mode Checker.
 * Verifies that uncommitted or PR changes have a corresponding valid GitSpar receipt.
 */
export async function runCiCheck(cwd: string = process.cwd()): Promise<number> {
  console.log(`\n${bold}${cyan}╔═══════════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${bold}${cyan}║                      GitSpar (v0.3.0)                             ║${reset}`);
  console.log(`${bold}${cyan}║                   CI / Non-Interactive Check                      ║${reset}`);
  console.log(`${bold}${cyan}╚═══════════════════════════════════════════════════════════════════╝${reset}\n`);

  const config = loadGitSparConfig(cwd);
  const baseRef = resolveBaseRef(cwd, config?.baseBranch);
  const receiptPath = resolve(cwd, '.gitspar/receipt.json');

  if (!existsSync(receiptPath)) {
    console.error(
      `${red}❌ GitSpar Check Failed: Working tree has unverified changes. Run \`npx gitspar\` locally to verify your changes before pushing.${reset}\n`
    );
    return 1;
  }

  let receipt: AssessmentReceipt;
  try {
    receipt = JSON.parse(readFileSync(receiptPath, 'utf-8'));
  } catch {
    console.error(
      `${red}❌ GitSpar Check Failed: Working tree has unverified changes. Run \`npx gitspar\` locally to verify your changes before pushing.${reset}\n`
    );
    return 1;
  }

  // Verify that receipt status is complete and passing
  if (!receipt.working_diff_sha256 || receipt.repair_test !== 'passed') {
    console.error(
      `${red}❌ GitSpar Check Failed: Working tree has unverified changes. Run \`npx gitspar\` locally to verify your changes before pushing.${reset}\n`
    );
    return 1;
  }

  const ciContext = getRepoContext(cwd, { ciMode: true, baseRef });
  const localContext = getRepoContext(cwd, { ciMode: false });

  // Compute potential candidate diff hashes for comparison:
  // 1. CI diff against baseRef (e.g. origin/main...HEAD)
  // 2. Local diff against HEAD
  const candidateHashes = new Set<string>([
    ciContext.workingDiffSha256,
    localContext.workingDiffSha256,
  ]);

  if (receipt.target_file) {
    candidateHashes.add(computeDiffHashForTarget(cwd, receipt.target_file, baseRef));
    candidateHashes.add(computeDiffHashForTarget(cwd, receipt.target_file, 'HEAD'));
    if (receipt.base_commit_sha && refExists(receipt.base_commit_sha, cwd)) {
      candidateHashes.add(computeDiffHashForTarget(cwd, receipt.target_file, receipt.base_commit_sha));
    }
  }

  // 3. Diff against receipt's recorded base_commit_sha (if still present in git history)
  if (receipt.base_commit_sha && refExists(receipt.base_commit_sha, cwd)) {
    candidateHashes.add(computeDiffHashForRef(cwd, `${receipt.base_commit_sha}...HEAD`, receipt.target_file));
    candidateHashes.add(computeDiffHashForRef(cwd, receipt.base_commit_sha, receipt.target_file));
  }

  // 4. Diff against resolved baseRef
  if (baseRef && baseRef !== 'HEAD') {
    candidateHashes.add(computeDiffHashForRef(cwd, `${baseRef}...HEAD`, receipt.target_file));
    candidateHashes.add(computeDiffHashForRef(cwd, baseRef, receipt.target_file));
  }

  const isVerified = candidateHashes.has(receipt.working_diff_sha256);

  if (!isVerified) {
    console.error(
      `${red}❌ GitSpar Check Failed: Working tree has unverified changes. Run \`npx gitspar\` locally to verify your changes before pushing.${reset}\n`
    );
    return 1;
  }

  console.log(`${dim}Base Ref / Diff Target:${reset} ${baseRef}`);
  console.log(`${dim}Working Diff SHA-256:${reset}  ${receipt.working_diff_sha256}`);
  console.log(`${dim}Verified Function:${reset}     ${cyan}${receipt.function_name}${reset} (${receipt.target_file})`);
  console.log(`${dim}Assessment Mode:${reset}       ${receipt.mode}`);
  console.log(`${dim}Diagnosed Line:${reset}        Line ${receipt.diagnosed_line}`);
  console.log(`${dim}Diagnostic Proof:${reset}      "${receipt.explanation}"\n`);
  console.log(
    `${bold}${green}✅ GitSpar Check Passed: Verified change receipt matches current working tree / commit diff.${reset}\n`
  );

  return 0;
}

export async function runCli(): Promise<void> {
  const prompt = new PromptInterface();
  const cwd = process.cwd();

  try {
    printHeader();

    // 1. Discover Changes & Eligible Functions
    const repoContext = getRepoContext(cwd);
    console.log(`${dim}Base Commit:${reset} ${repoContext.baseCommitSha}`);
    console.log(`${dim}Working Diff SHA-256:${reset} ${repoContext.workingDiffSha256}\n`);

    let targetFiles: string[] = [];
    const directFileArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));

    if (directFileArg) {
      const fullDirectPath = resolve(cwd, directFileArg);
      if (!existsSync(fullDirectPath)) {
        console.error(`${red}Error: File not found: ${directFileArg}${reset}`);
        process.exit(1);
      }
      targetFiles = [fullDirectPath];
    } else {
      targetFiles = repoContext.changedFiles;
    }

    const eligibleFunctions: EligibleFunction[] = [];
    for (const file of targetFiles) {
      const funcs = discoverEligibleFunctions(file);
      eligibleFunctions.push(...funcs);
    }

    if (eligibleFunctions.length === 0) {
      console.log(
        `${yellow}No eligible pure TypeScript functions with boundary conditions detected in working tree.${reset}`
      );
      if (!directFileArg) {
        console.log(`${dim}Tip: You can target a file directly: npx gitspar <path/to/file.ts>${reset}\n`);
      }
      prompt.close();
      return;
    }

    // 2. Function Selection
    console.log(`${bold}Eligible Exported Functions Found:${reset}`);
    eligibleFunctions.forEach((fn, idx) => {
      const rel = relative(cwd, fn.filePath).replace(/\\/g, '/');
      console.log(`  [${bold}${idx + 1}${reset}] ${cyan}${fn.functionName}${reset} ${dim}(${rel}:${fn.startLine})${reset}`);
      console.log(`      ${dim}${fn.signature}${reset}`);
    });

    let selectedFunction: EligibleFunction = eligibleFunctions[0];
    if (eligibleFunctions.length > 1) {
      while (true) {
        const choiceRaw = await prompt.question(`\nSelect a function to assess (1-${eligibleFunctions.length}): `);
        const choice = parseInt(choiceRaw.trim(), 10);
        if (!isNaN(choice) && choice >= 1 && choice <= eligibleFunctions.length) {
          selectedFunction = eligibleFunctions[choice - 1];
          break;
        }
        console.log(`${red}Invalid choice. Enter a number between 1 and ${eligibleFunctions.length}.${reset}`);
      }
    } else {
      console.log(`\nAuto-selected: ${cyan}${selectedFunction.functionName}${reset}`);
    }

    // Explicit User Execution Approval (Rule 3)
    const approval = (
      await prompt.question(
        `\n${yellow}Approve running this function in a local Vitest harness? (y/n): ${reset}`
      )
    )
      .trim()
      .toLowerCase();

    if (approval !== 'y' && approval !== 'yes') {
      console.log(`${red}Execution cancelled by user.${reset}`);
      prompt.close();
      return;
    }

    // 3. Blind Independent Oracle Step (Rule 1)
    console.log(`\n${bold}${magenta}====================================================================${reset}`);
    console.log(`${bold}${magenta}RULE 1: INDEPENDENT BEHAVIORAL ORACLE (BLIND SPECIFICATION)${reset}`);
    console.log(`${bold}${magenta}====================================================================${reset}`);
    console.log(`${dim}Implementation body is hidden to prevent self-fulfilling test bias.${reset}`);
    console.log(`\nTarget Signature:`);
    console.log(`  ${bold}${green}${selectedFunction.signature}${reset}\n`);

    let inputResult = await promptOracleArguments(
      prompt,
      `${bold}Enter test input arguments as a JSON array (choose a boundary value, e.g. [100, false] or 100, false): ${reset}`
    );

    let outputResult = await promptValidJson<unknown>(
      prompt,
      `${bold}Without looking at the code body, what is the required return value for that input? (e.g. 90): ${reset}`,
      () => ({ valid: true })
    );

    // 4. Baseline Execution & Automatic Mode Routing (Rule 2)
    console.log(`\n${dim}Running Vitest on unmodified baseline implementation...${reset}`);
    let baselineResult = runIsolatedVitestCheck(
      selectedFunction.filePath,
      selectedFunction.functionName,
      inputResult.raw,
      outputResult.raw,
      cwd
    );

    let mode: 'mutation_drill' | 'real_defect';
    let mutationMeta: MutationResult | null = null;
    let baselineTest: 'passed' | 'failed' = 'passed';
    let mutationTest: 'failed' | 'not_applicable' = 'not_applicable';
    let diagnosedLine = 0;
    let explanation = '';
    const agentReasoningTrace: string[] = [];

    if (!baselineResult.passed) {
      // -------------------------------------------------------------
      // MODE B: Real Defect Discovery
      // -------------------------------------------------------------
      mode = 'real_defect';
      baselineTest = 'failed';
      console.log(`\n${bold}${red}🚨 MODE B (REAL DEFECT): Your unmodified code failed your stated behavioral requirement!${reset}`);
      console.log(`${dim}Vitest Output:${reset}\n${baselineResult.rawOutput}\n`);
      console.log(`${bold}Current Implementation:${reset}`);
      console.log(selectedFunction.fullFunctionCodeWithLines);
      console.log('');

      while (true) {
        const lineStr = (await prompt.question(`${bold}Which line number contains the defect? ${reset}`)).trim();
        const line = parseInt(lineStr, 10);
        if (!isNaN(line) && line >= selectedFunction.startLine && line <= selectedFunction.endLine) {
          diagnosedLine = line;
          break;
        }
        console.log(
          `${red}Please enter a valid line number between ${selectedFunction.startLine} and ${selectedFunction.endLine}.${reset}`
        );
      }

      console.log(
        `\n${yellow}Please open ${relative(cwd, selectedFunction.filePath)} and fix the defect.${reset}`
      );

      while (true) {
        await prompt.question(`Press [Enter] once you have saved your fix to re-run Vitest: `);
        const retryResult = runIsolatedVitestCheck(
          selectedFunction.filePath,
          selectedFunction.functionName,
          inputResult.raw,
          outputResult.raw,
          cwd
        );

        if (retryResult.passed) {
          console.log(`${green}✅ Verified! Your fix passed the independent oracle check.${reset}`);
          break;
        }
        console.log(`${red}❌ Test still failing:${reset}\n${retryResult.rawOutput}\n`);
      }

      const evaluator = new SocraticEvaluatorAgent();
      while (true) {
        explanation = (
          await prompt.question(
            `\n${bold}In 1-2 sentences, explain the real defect you fixed: ${reset}`
          )
        ).trim();

        const evalResult = await evaluator.evaluateExplanation({
          explanation,
          functionName: selectedFunction.functionName,
          signature: selectedFunction.signature,
          originalExpression: `Line ${diagnosedLine} defect repair`,
          mutatedExpression: `Line ${diagnosedLine} defect repair`,
          mutatedLine: diagnosedLine,
          mutatedOperator: 'defect_fix',
          oracleInput: inputResult.parsed,
          oracleExpectedOutput: outputResult.parsed,
          variableNames: selectedFunction.parameterNames,
        });

        if (evalResult.approved) {
          console.log(`${green}✅ Socratic Evaluator Approved: ${evalResult.feedback ?? 'Diagnostic explanation confirmed.'}${reset}`);
          agentReasoningTrace.push(`[SocraticEvaluator] Approved defect explanation with score ${evalResult.score}/100.`);
          break;
        } else {
          console.log(`\n${yellow}⚠️ Socratic Feedback (${evalResult.score}/100): ${evalResult.socraticPrompt ?? evalResult.reasoning}${reset}`);
        }
      }
    } else {
      // -------------------------------------------------------------
      // MODE A: Mutation Drill (Controlled Fault Diagnosis via SaboteurAgent)
      // -------------------------------------------------------------
      mode = 'mutation_drill';
      baselineTest = 'passed';
      console.log(`\n${green}✅ Baseline passed! Invoking SaboteurAgent retry loop (Mode A)...${reset}`);

      const tempMutantPath = resolve(cwd, '.gitspar/temp/mutant.ts');
      const saboteur = new SaboteurAgent(cwd);
      const saboteurResult = await saboteur.findKillingMutant(
        selectedFunction.filePath,
        selectedFunction.functionName,
        inputResult.raw,
        outputResult.raw,
        tempMutantPath
      );

      mutationMeta = saboteurResult.killingMutant;
      agentReasoningTrace.push(...saboteurResult.agentTrace);

      // Verify that mutant fails with the user's input
      let mutantResult = runIsolatedVitestCheck(
        tempMutantPath,
        selectedFunction.functionName,
        inputResult.raw,
        outputResult.raw,
        cwd
      );

      while (mutantResult.passed) {
        console.log(
          `\n${yellow}⚠️ The mutant still passed! Your test input did not exercise the boundary condition.${reset}`
        );
        console.log(
          `${dim}To kill the boundary mutant, specify input arguments that hit the edge boundary.${reset}\n`
        );

        inputResult = await promptOracleArguments(
          prompt,
          `${bold}Enter boundary test input arguments (e.g. [100, false] or 100, false): ${reset}`
        );

        outputResult = await promptValidJson<unknown>(
          prompt,
          `${bold}What is the required return value for that boundary input?: ${reset}`,
          () => ({ valid: true })
        );

        // Re-check baseline on original
        baselineResult = runIsolatedVitestCheck(
          selectedFunction.filePath,
          selectedFunction.functionName,
          inputResult.raw,
          outputResult.raw,
          cwd
        );

        if (!baselineResult.passed) {
          console.log(`${red}Baseline failed on this input! Please enter valid boundary input.${reset}`);
          continue;
        }

        // Re-check mutant
        mutantResult = runIsolatedVitestCheck(
          tempMutantPath,
          selectedFunction.functionName,
          inputResult.raw,
          outputResult.raw,
          cwd
        );
      }

      mutationTest = 'failed';
      console.log(`\n${bold}${red}💥 MUTANT KILLED (RED)! A boundary condition defect was injected into a temp copy.${reset}`);
      console.log(`${dim}Mutated function code with line numbers:${reset}`);
      console.log(mutationMeta.mutatedFunctionCode);
      console.log('');

      // Prompt 1: Diagnose line
      while (true) {
        const lineStr = (
          await prompt.question(`${bold}Which line number contains the broken boundary condition? ${reset}`)
        ).trim();
        const line = parseInt(lineStr, 10);
        if (line === mutationMeta.mutatedLine) {
          diagnosedLine = line;
          console.log(`${green}✅ Correct! Defect is on line ${mutationMeta.mutatedLine}.${reset}`);
          break;
        }
        console.log(
          `${red}❌ Incorrect line number. Look closely at the boundary condition. Try again.${reset}`
        );
      }

      // Prompt 2: Correct operator
      const correctOp = (
        await prompt.question(
          `${bold}What should the correct operator/expression on that line be? ${reset}`
        )
      ).trim();

      // Prompt 3: Explanation graded by SocraticEvaluatorAgent
      const evaluator = new SocraticEvaluatorAgent();
      while (true) {
        explanation = (
          await prompt.question(
            `\n${bold}In 1-2 sentences, explain why this boundary mutation caused your test input to fail: ${reset}`
          )
        ).trim();

        const evalResult = await evaluator.evaluateExplanation({
          explanation,
          functionName: selectedFunction.functionName,
          signature: selectedFunction.signature,
          originalExpression: mutationMeta.originalExpression,
          mutatedExpression: mutationMeta.mutatedExpression,
          mutatedLine: mutationMeta.mutatedLine,
          mutatedOperator: mutationMeta.mutatedOperator,
          oracleInput: inputResult.parsed,
          oracleExpectedOutput: outputResult.parsed,
          variableNames: selectedFunction.parameterNames,
        });

        if (evalResult.approved) {
          console.log(`${green}✅ Socratic Evaluator Approved: ${evalResult.feedback ?? 'Diagnostic proof accepted.'}${reset}`);
          agentReasoningTrace.push(`[SocraticEvaluator] Approved explanation with score ${evalResult.score}/100.`);
          break;
        } else {
          console.log(`\n${yellow}⚠️ Socratic Feedback (${evalResult.score}/100): ${evalResult.socraticPrompt ?? evalResult.reasoning}${reset}`);
        }
      }

      // Confirm original function still GREEN
      const finalCheck = runIsolatedVitestCheck(
        selectedFunction.filePath,
        selectedFunction.functionName,
        inputResult.raw,
        outputResult.raw,
        cwd
      );

      if (!finalCheck.passed) {
        throw new Error('Unmodified function failed final verification check.');
      }
    }

    // -------------------------------------------------------------
    // Transfer Probe Agent (Unseen Counterfactual Input Verification)
    // -------------------------------------------------------------
    console.log(`\n${bold}${magenta}====================================================================${reset}`);
    console.log(`${bold}${magenta}TRANSFER PROBE: UNSEEN COUNTERFACTUAL BOUNDARY ASSESSMENT${reset}`);
    console.log(`${bold}${magenta}====================================================================${reset}`);
    const transferAgent = new TransferProbeAgent(cwd);
    const probe = transferAgent.synthesizeProbe(inputResult.parsed, selectedFunction.functionName, selectedFunction.signature);
    agentReasoningTrace.push(`[TransferProbeAgent] ${probe.reasoning}`);

    let groundTruth: unknown = null;
    try {
      groundTruth = transferAgent.computeGroundTruth(selectedFunction.filePath, selectedFunction.functionName, probe.probeInput);
    } catch {
      // Continue gracefully if ground truth execution cannot run
    }

    let transferPassed = false;
    let transferAnswer = '';
    if (groundTruth !== null) {
      console.log(`${dim}Transfer Probe synthesized: unseen input near boundary.${reset}`);
      console.log(`\n${bold}Transfer Check: Without running the code, what will ${cyan}${selectedFunction.functionName}(${JSON.stringify(probe.probeInput).slice(1, -1)})${reset} return? ${reset}`);
      transferAnswer = (await prompt.question(`Your expected return value: `)).trim();
      transferPassed = transferAgent.evaluateUserAnswer(transferAnswer, groundTruth);

      if (transferPassed) {
        console.log(`${green}✅ Correct! Return value matches ground-truth (${JSON.stringify(groundTruth)}). Generalization confirmed.${reset}`);
        agentReasoningTrace.push(`[TransferProbeAgent] Developer correctly predicted unseen input: ${transferAnswer} == ${JSON.stringify(groundTruth)}`);
      } else {
        console.log(`${yellow}⚠️ Transfer prediction mismatch. Expected ${JSON.stringify(groundTruth)}, got "${transferAnswer}".${reset}`);
        agentReasoningTrace.push(`[TransferProbeAgent] Prediction mismatch: expected ${JSON.stringify(groundTruth)}, got "${transferAnswer}"`);
      }
    }

    // Clean up temporary mutant files
    const tempDir = resolve(cwd, '.gitspar/temp');
    if (existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }

    // 5. Generate Receipt
    const receipt: AssessmentReceipt = {
      timestamp: new Date().toISOString(),
      base_commit_sha: repoContext.baseCommitSha,
      working_diff_sha256: repoContext.workingDiffSha256,
      mode,
      language: 'typescript',
      target_file: relative(cwd, selectedFunction.filePath).replace(/\\/g, '/'),
      function_name: selectedFunction.functionName,
      oracle_source: 'user_specified_blind_assertion',
      oracle_input: inputResult.parsed,
      oracle_expected_output: outputResult.parsed,
      mutation_operator: mutationMeta ? mutationMeta.mutatedOperator : null,
      baseline_test: baselineTest,
      mutation_test: mutationTest,
      repair_test: 'passed',
      diagnosed_line: diagnosedLine,
      explanation,
      transfer_check_input: groundTruth !== null ? probe.probeInput : undefined,
      transfer_check_expected: groundTruth !== null ? groundTruth : undefined,
      transfer_check_user_answer: groundTruth !== null ? transferAnswer : undefined,
      transfer_check_passed: groundTruth !== null ? transferPassed : undefined,
      agent_reasoning_trace: agentReasoningTrace,
    };

    const saved = saveReceipt(receipt);
    console.log(`\n${bold}${green}🎉 Assessment Complete! Verified Change Understanding Receipt Generated:${reset}`);
    console.log(`  📄 JSON Receipt: ${cyan}${saved.jsonPath}${reset}`);
    console.log(`  📋 PR Markdown:  ${cyan}${saved.markdownPath}${reset}\n`);
  } finally {
    prompt.close();
  }
}

// Execute when invoked directly
if (process.argv[1] && (process.argv[1].endsWith('cli.ts') || process.argv[1].endsWith('cli.js'))) {
  const isCi = process.argv.includes('--ci') || process.argv.includes('--check');
  if (isCi) {
    runCiCheck()
      .then((code) => process.exit(code))
      .catch((err) => {
        console.error(`\n${red}Error during GitSpar CI check:${reset}`, err);
        process.exit(1);
      });
  } else {
    runCli().catch((err) => {
      console.error(`\n${red}Error during GitSpar assessment:${reset}`, err);
      process.exit(1);
    });
  }
}
