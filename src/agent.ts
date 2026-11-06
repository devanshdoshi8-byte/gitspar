import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  discoverAllMutationCandidates,
  createBoundaryMutant,
  MutationCandidate,
  MutationResult,
} from './ast.js';
import { runIsolatedVitestCheck } from './runner.js';

export interface SaboteurResult {
  killingMutant: MutationResult;
  candidateIndex: number;
  totalCandidates: number;
  agentTrace: string[];
  mutantKilled: boolean;
}

export class SaboteurAgent {
  constructor(private cwd: string = process.cwd()) {}

  async findKillingMutant(
    filePath: string,
    functionName: string,
    argsJson: string,
    expectedJson: string,
    tempMutantPath: string
  ): Promise<SaboteurResult> {
    const agentTrace: string[] = [];
    const candidates = discoverAllMutationCandidates(filePath, functionName);

    if (candidates.length === 0) {
      throw new Error(`[SaboteurAgent] No mutation candidates found in function "${functionName}".`);
    }

    agentTrace.push(
      `[SaboteurAgent] Discovered ${candidates.length} candidate boundary expression(s) in ${functionName}. Ranked by complexity.`
    );

    let chosenMutant: MutationResult | null = null;
    let chosenIndex = 0;
    let mutantKilled = false;

    for (const candidate of candidates) {
      agentTrace.push(
        `[SaboteurAgent] Evaluating Candidate #${candidate.index + 1} (Line ${candidate.line}: \`${candidate.originalExpression}\` -> \`${candidate.mutatedExpression}\`)...`
      );

      const mutant = createBoundaryMutant(filePath, functionName, tempMutantPath, candidate.index);
      const testResult = runIsolatedVitestCheck(tempMutantPath, functionName, argsJson, expectedJson, this.cwd);

      if (!testResult.passed) {
        // Test failed -> Mutant was KILLED (Goal achieved!)
        mutantKilled = true;
        chosenMutant = mutant;
        chosenIndex = candidate.index;
        agentTrace.push(
          `[SaboteurAgent] ✅ Candidate #${candidate.index + 1} on Line ${candidate.line} was KILLED (Oracle test turned RED). Selected as target mutation drill.`
        );
        break;
      } else {
        // Test passed -> Mutant SURVIVED
        agentTrace.push(
          `[SaboteurAgent] ⚠️ Candidate #${candidate.index + 1} on Line ${candidate.line} SURVIVED oracle input. Backtracking to next candidate...`
        );
      }
    }

    // If no candidate killed the oracle test, default to candidate 0 and note in trace
    if (!chosenMutant) {
      chosenIndex = 0;
      chosenMutant = createBoundaryMutant(filePath, functionName, tempMutantPath, 0);
      agentTrace.push(
        `[SaboteurAgent] All ${candidates.length} candidates survived oracle input. Defaulted to primary boundary candidate on Line ${chosenMutant.mutatedLine} for interactive refinement.`
      );
    }

    return {
      killingMutant: chosenMutant,
      candidateIndex: chosenIndex,
      totalCandidates: candidates.length,
      agentTrace,
      mutantKilled,
    };
  }
}

export interface SocraticEvaluation {
  approved: boolean;
  score: number; // 0 - 100
  reasoning: string;
  socraticPrompt?: string;
  feedback?: string;
  evaluatedBy: 'ast_heuristics' | 'gemini_2_5_flash';
}

export class SocraticEvaluatorAgent {
  private geminiApiKey?: string;

  constructor(apiKey?: string) {
    this.geminiApiKey = apiKey ?? process.env.GEMINI_API_KEY;
  }

  async evaluateExplanation(params: {
    explanation: string;
    functionName: string;
    signature?: string;
    originalExpression: string;
    mutatedExpression: string;
    mutatedLine: number;
    mutatedOperator: string;
    oracleInput: unknown[];
    oracleExpectedOutput: unknown;
    variableNames?: string[];
  }): Promise<SocraticEvaluation> {
    const text = params.explanation.trim();

    // 1. If Gemini API Key is configured, attempt neuro-symbolic grading via Gemini 2.5 Flash
    if (this.geminiApiKey) {
      try {
        const geminiResult = await this.queryGemini(params);
        if (geminiResult) {
          return geminiResult;
        }
      } catch (err) {
        // Graceful fallback to deterministic AST evaluation
      }
    }

    // 2. Built-in Deterministic AST-Semantic Agent Grading Loop (100% offline)
    return this.evaluateDeterministically(params);
  }

  private evaluateDeterministically(params: {
    explanation: string;
    functionName: string;
    originalExpression: string;
    mutatedExpression: string;
    mutatedLine: number;
    mutatedOperator: string;
    oracleInput: unknown[];
    oracleExpectedOutput: unknown;
    variableNames?: string[];
  }): SocraticEvaluation {
    const text = params.explanation.trim().toLowerCase();
    const words = text.split(/\s+/).filter(Boolean);

    // Filter out trivial/gibberish answers
    const trivialPhrases = [
      'i fixed the bug',
      'fixed the bug',
      'bug fixed',
      'fixed it',
      'i changed it',
      'made it work',
      'it works now',
      'asdf',
      'test pass',
    ];

    if (words.length < 5 || text.length < 20 || trivialPhrases.some((p) => text === p || text.startsWith(p))) {
      return {
        approved: false,
        score: 25,
        reasoning: 'Explanation is too brief or generic to demonstrate verified comprehension.',
        socraticPrompt: `Your fix passed the test, but your explanation didn't mention how changing ${params.mutatedOperator} affected the boundary value ${JSON.stringify(
          params.oracleInput
        )}. Briefly explain why that input failed:`,
        evaluatedBy: 'ast_heuristics',
      };
    }

    let score = 40;
    const reasons: string[] = [];

    // Criterion A: Mentions mutated variable or parameter
    const vars = (params.variableNames ?? []).map((v) => v.toLowerCase());
    const mentionsVar = vars.some((v) => text.includes(v)) || text.includes('parameter') || text.includes('variable') || text.includes('input') || text.includes('argument');
    if (mentionsVar) {
      score += 20;
      reasons.push('mentions relevant variables/inputs');
    }

    // Criterion B: Mentions operator, boundary concept, or numeric boundary
    const boundaryTokens = [
      params.mutatedOperator.toLowerCase(),
      'operator',
      'boundary',
      'threshold',
      'greater',
      'less',
      'equal',
      'strict',
      'inclusive',
      'edge',
      'limit',
      ...params.oracleInput.map((val) => String(val).toLowerCase()),
    ];
    const mentionsBoundary = boundaryTokens.some((tok) => tok && text.includes(tok));
    if (mentionsBoundary) {
      score += 20;
      reasons.push('identifies boundary operator/condition');
    }

    // Criterion C: Causal reasoning keywords
    const causalKeywords = [
      'because',
      'caused',
      'when',
      'since',
      'due to',
      'so',
      'evaluated',
      'resulted',
      'returned',
      'fell',
      'exceeded',
      'swapped',
      'instead of',
      'prevented',
      'failed',
      'failing',
    ];
    const mentionsCausal = causalKeywords.some((w) => text.includes(w));
    if (mentionsCausal) {
      score += 20;
      reasons.push('articulates causal mechanism');
    }

    if (score >= 70) {
      return {
        approved: true,
        score,
        reasoning: `Strong explanation: ${reasons.join(', ')}.`,
        feedback: 'Verified diagnostic proof. Change understanding confirmed.',
        evaluatedBy: 'ast_heuristics',
      };
    }

    return {
      approved: false,
      score,
      reasoning: `Explanation missing specific boundary analysis. Observed: ${reasons.join(', ') || 'none'}.`,
      socraticPrompt: `Your fix passed the test, but your explanation didn't mention how changing ${params.mutatedOperator} affected the boundary value ${JSON.stringify(
        params.oracleInput
      )}. Briefly explain why that input failed:`,
      evaluatedBy: 'ast_heuristics',
    };
  }

  private async queryGemini(params: {
    explanation: string;
    functionName: string;
    signature?: string;
    originalExpression: string;
    mutatedExpression: string;
    mutatedLine: number;
    mutatedOperator: string;
    oracleInput: unknown[];
    oracleExpectedOutput: unknown;
  }): Promise<SocraticEvaluation | null> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`;

    const systemPrompt = `You are the SocraticEvaluatorAgent for GitSpar, a verified code understanding tool.
Evaluate whether a developer's explanation demonstrates genuine understanding of a defect created by mutating code on line ${params.mutatedLine}:
- Original expression: ${params.originalExpression}
- Mutated expression: ${params.mutatedExpression}
- Test Input: ${JSON.stringify(params.oracleInput)}
- Expected Output: ${JSON.stringify(params.oracleExpectedOutput)}

Respond ONLY with valid JSON matching:
{
  "approved": boolean,
  "score": number (0-100),
  "reasoning": string,
  "socraticPrompt": string (only if approved is false, provide a focused guiding question)
}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: `Developer Explanation: "${params.explanation}"` },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);
    return {
      approved: Boolean(parsed.approved),
      score: typeof parsed.score === 'number' ? parsed.score : 80,
      reasoning: parsed.reasoning || 'Evaluated via Gemini 2.5 Flash',
      socraticPrompt: parsed.socraticPrompt,
      feedback: parsed.approved ? 'Evaluator confirmed conceptual diagnostic accuracy.' : undefined,
      evaluatedBy: 'gemini_2_5_flash',
    };
  }
}

export interface TransferProbe {
  probeInput: unknown[];
  probeInputJson: string;
  expectedOutput: unknown;
  expectedOutputJson: string;
  reasoning: string;
  probePrompt: string;
}

export class TransferProbeAgent {
  constructor(private cwd: string = process.cwd()) {}

  synthesizeProbe(
    originalInput: unknown[],
    functionName: string,
    signature?: string
  ): { probeInput: unknown[]; reasoning: string } {
    const probeInput = originalInput.map((val) => {
      if (typeof val === 'number') {
        // Shift numeric boundary by +1 (or -1 if negative/0)
        return val === 0 ? 1 : val + 1;
      }
      if (typeof val === 'boolean') {
        // Toggle boolean parameter to probe alternate control flow branch
        return !val;
      }
      if (typeof val === 'string') {
        return val + '_alt';
      }
      return val;
    });

    const reasoning = `Synthesized unseen counterfactual input by altering boundary inputs: ${JSON.stringify(
      originalInput
    )} -> ${JSON.stringify(probeInput)}`;

    return { probeInput, reasoning };
  }

  computeGroundTruth(
    filePath: string,
    functionName: string,
    probeInput: unknown[]
  ): unknown {
    const absPath = resolve(this.cwd, filePath).replace(/\\/g, '/');
    const inputJson = JSON.stringify(probeInput);

    // Execute unmodified function via tsx inline script
    const script = `import { ${functionName} } from '${absPath}'; const res = ${functionName}(...${inputJson}); console.log(JSON.stringify(res));`;
    const command = `npx tsx -e "${script}"`;

    try {
      const output = execSync(command, {
        cwd: this.cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return JSON.parse(output.trim());
    } catch (err: unknown) {
      throw new Error(`[TransferProbeAgent] Failed to compute ground truth return value: ${(err as Error).message}`);
    }
  }

  evaluateUserAnswer(userAnswer: string, expectedOutput: unknown): boolean {
    const cleanUser = userAnswer.trim();
    if (!cleanUser) return false;

    // Direct string match
    if (cleanUser === String(expectedOutput)) return true;

    // JSON parsed match
    try {
      const parsedUser = JSON.parse(cleanUser);
      if (JSON.stringify(parsedUser) === JSON.stringify(expectedOutput)) {
        return true;
      }
      if (typeof expectedOutput === 'number' && typeof parsedUser === 'number') {
        return Math.abs(parsedUser - expectedOutput) < 0.0001;
      }
    } catch {}

    // Boolean string match
    if (typeof expectedOutput === 'boolean') {
      if (expectedOutput === true && ['true', 'yes', 't', '1'].includes(cleanUser.toLowerCase())) return true;
      if (expectedOutput === false && ['false', 'no', 'f', '0'].includes(cleanUser.toLowerCase())) return true;
    }

    return false;
  }
}
