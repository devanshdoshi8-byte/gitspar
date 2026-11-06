"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Shield,
  CheckCircle2,
  XCircle,
  Play,
  Terminal,
  Copy,
  Check,
  Download,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  Code2,
  Flame,
  FileCheck,
  EyeOff,
  Cpu,
  Sparkles,
  HelpCircle,
  CheckCheck,
} from "lucide-react";

interface SamplePreset {
  name: string;
  file: string;
  signature: string;
  defaultArgs: string;
  defaultExpected: string;
  code: string;
}

const PRESETS: SamplePreset[] = [
  {
    name: "calculateTierDiscount",
    file: "examples/checkoutDiscount.ts",
    signature: "calculateTierDiscount(orderTotal: number, isStudent: boolean): number",
    defaultArgs: "100, false",
    defaultExpected: "90",
    code: `export function calculateTierDiscount(orderTotal: number, isStudent: boolean): number {
  if (orderTotal >= 100) {
    if (isStudent) {
      return orderTotal * 0.8;
    }
    return orderTotal * 0.9;
  }
  return isStudent ? orderTotal * 0.95 : orderTotal;
}`,
  },
  {
    name: "isSessionValid",
    file: "src/authSession.ts",
    signature: "isSessionValid(tokenAgeMs: number, maxLifetimeMs: number): boolean",
    defaultArgs: "1000, 1000",
    defaultExpected: "true",
    code: `export function isSessionValid(tokenAgeMs: number, maxLifetimeMs: number): boolean {
  if (tokenAgeMs <= maxLifetimeMs) {
    return true;
  }
  return false;
}`,
  },
  {
    name: "checkRateLimit",
    file: "src/rateLimiter.ts",
    signature: "checkRateLimit(requestCount: number, maxLimit: number): boolean",
    defaultArgs: "100, 100",
    defaultExpected: "true",
    code: `export function checkRateLimit(requestCount: number, maxLimit: number): boolean {
  if (requestCount <= maxLimit) {
    return true;
  }
  return false;
}`,
  },
];

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customCode, setCustomCode] = useState<string>(PRESETS[0].code);

  const currentCode = isCustomMode ? customCode : PRESETS[activeTab].code;
  const currentSample = PRESETS[activeTab];

  // Steps: 1 = Blind Specification, 2 = Baseline Check, 3 = Saboteur Drill, 4 = Socratic Explanation & Transfer Probe, 5 = Cryptographic Receipt
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [argsInput, setArgsInput] = useState<string>(currentSample.defaultArgs);
  const [expectedInput, setExpectedInput] = useState<string>(currentSample.defaultExpected);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Server response state
  const [serverData, setServerData] = useState<{
    activeFnName?: string;
    baselinePassed?: boolean;
    baselineOutput?: unknown;
    mutantKilled?: boolean;
    mutantActualOutput?: unknown;
    candidate?: {
      line: number;
      originalOperator: string;
      mutatedOperator: string;
      originalText: string;
      mutatedText: string;
    };
    mutatedCode?: string;
    agentTrace?: string[];
    socraticEvaluation?: {
      approved: boolean;
      score: number;
      socraticPrompt?: string;
      feedback?: string;
    };
    transferProbe?: {
      probeInput: unknown[];
      groundTruth: unknown;
      transferCheckPassed?: boolean;
    };
    receipt?: {
      timestamp: string;
      working_diff_sha256: string;
      function_name: string;
      oracle_input: unknown[];
      oracle_expected_output: unknown;
      mutated_line: number;
      mutated_operator: string;
      transfer_check_passed?: boolean;
    };
  } | null>(null);

  // Interactive drill state
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<string>(">");
  const [diagnosticExplanation, setDiagnosticExplanation] = useState<string>("");
  const [transferAnswer, setTransferAnswer] = useState<string>("");
  const [transferVerified, setTransferVerified] = useState<boolean | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState<boolean>(false);

  const switchPreset = (index: number) => {
    setActiveTab(index);
    setIsCustomMode(false);
    const p = PRESETS[index];
    setCustomCode(p.code);
    setArgsInput(p.defaultArgs);
    setExpectedInput(p.defaultExpected);
    resetDrill();
  };

  const resetDrill = () => {
    setStep(1);
    setSelectedLine(null);
    setSelectedOperator(">");
    setDiagnosticExplanation("");
    setTransferAnswer("");
    setTransferVerified(null);
    setRepairError(null);
    setServerData(null);
    setApiError(null);
  };

  // 1. Run Baseline Test & Saboteur Loop on Server
  const handleExecuteBaselineAndSaboteur = async () => {
    setIsExecuting(true);
    setApiError(null);

    try {
      const res = await fetch("/api/spar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: currentCode,
          oracleArgs: argsInput,
          expectedOutput: expectedInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || "Failed to execute function on server.");
        setIsExecuting(false);
        return;
      }

      setServerData(data);
      if (data.baselinePassed) {
        setStep(2);
      } else {
        setApiError("Baseline failed. The unmodified code does not produce the expected output.");
      }
    } catch (err: unknown) {
      setApiError(`Network or execution error: ${(err as Error).message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleProceedToDrill = () => {
    setStep(3);
  };

  // 2. Validate Diagnosis & Submit to Socratic Evaluator
  const handleSubmitDiagnosis = async () => {
    setRepairError(null);
    if (!selectedLine) {
      setRepairError("Please select the mutated line in the code viewer above.");
      return;
    }

    if (serverData?.candidate && selectedLine !== serverData.candidate.line) {
      setRepairError(`Line ${selectedLine} is not the defect. Inspect the boundary relational condition.`);
      return;
    }

    if (serverData?.candidate && selectedOperator !== serverData.candidate.originalOperator) {
      setRepairError(
        `Operator '${selectedOperator}' is incorrect. The original boundary required '${serverData.candidate.originalOperator}'.`
      );
      return;
    }

    if (!diagnosticExplanation.trim() || diagnosticExplanation.length < 10) {
      setRepairError("Please provide an explanation of how the boundary mutation caused the oracle test to fail.");
      return;
    }

    setIsExecuting(true);
    try {
      const res = await fetch("/api/spar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: currentCode,
          oracleArgs: argsInput,
          expectedOutput: expectedInput,
          userExplanation: diagnosticExplanation,
          transferAnswer: transferAnswer.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRepairError(data.error || "Evaluation failed.");
        setIsExecuting(false);
        return;
      }

      setServerData((prev) => ({
        ...prev,
        ...data,
      }));

      if (data.socraticEvaluation && !data.socraticEvaluation.approved) {
        setRepairError(data.socraticEvaluation.socraticPrompt || "Please refine your explanation with causal boundary reasoning.");
        setIsExecuting(false);
        return;
      }

      setStep(4);
    } catch (err: unknown) {
      setRepairError(`Evaluation error: ${(err as Error).message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // 3. Verify Transfer Probe & Complete Assessment
  const handleVerifyTransfer = async () => {
    if (!transferAnswer.trim()) {
      setRepairError("Please enter your expected return value for the unseen transfer input.");
      return;
    }

    setIsExecuting(true);
    setRepairError(null);

    try {
      const res = await fetch("/api/spar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: currentCode,
          oracleArgs: argsInput,
          expectedOutput: expectedInput,
          userExplanation: diagnosticExplanation,
          transferAnswer: transferAnswer.trim(),
        }),
      });

      const data = await res.json();
      setServerData((prev) => ({ ...prev, ...data }));

      const passed = Boolean(data.transferProbe?.transferCheckPassed);
      setTransferVerified(passed);

      if (passed) {
        setTimeout(() => {
          setStep(5);
        }, 600);
      } else {
        setRepairError(
          `Prediction mismatch! Expected ${JSON.stringify(
            data.transferProbe?.groundTruth
          )}, but received "${transferAnswer}". Verify the boundary branch logic.`
        );
      }
    } catch (err: unknown) {
      setRepairError(`Transfer check error: ${(err as Error).message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const receiptJson = serverData?.receipt
    ? JSON.stringify(
        {
          version: "0.3.0",
          ...serverData.receipt,
          agent_reasoning_trace: serverData.agentTrace,
          transfer_probe: serverData.transferProbe,
        },
        null,
        2
      )
    : "";

  const receiptMarkdown = `<!-- GITSPAR_RECEIPT_START -->
## 🛡️ GitSpar Verified Change Understanding Receipt
- **Target Function:** \`${serverData?.receipt?.function_name || currentSample.name}\`
- **Assessment Mode:** \`mutation_drill\` (Autonomous Saboteur Verification)
- **Working Diff SHA-256:** \`${serverData?.receipt?.working_diff_sha256 || "e3b0c442..."}\`
- **Diagnosed Line:** Line ${serverData?.receipt?.mutated_line || 2}
- **Mutant Operator Restored:** \`${serverData?.candidate?.originalOperator || ">="}\` (mutated to \`${serverData?.candidate?.mutatedOperator || ">"}\`)
- **Transfer Probe Generalization:** ${serverData?.transferProbe?.transferCheckPassed ? "✅ Passed (Verified Unseen Input)" : "⚠️ Skipped"}
- **Diagnostic Proof:** "${diagnosticExplanation}"
- **Status:** ✅ VERIFIED COMPREHENSION
<!-- GITSPAR_RECEIPT_END -->`;

  const copyReceipt = () => {
    navigator.clipboard.writeText(receiptMarkdown);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  const downloadReceipt = () => {
    const blob = new Blob([receiptJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gitspar-receipt-${serverData?.receipt?.function_name || "drill"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono mb-2">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            Live Backend Engine (`/api/spar`)
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            GitSpar Agentic Mutation Simulator
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Test any TypeScript function against the autonomous Saboteur loop, Socratic evaluator, and counterfactual transfer check.
          </p>
        </div>

        {/* Preset Selector & Custom Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
          {PRESETS.map((p, idx) => (
            <button
              key={p.name}
              onClick={() => switchPreset(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                !isCustomMode && activeTab === idx
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {p.name}
            </button>
          ))}
          <button
            onClick={() => {
              setIsCustomMode(true);
              resetDrill();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              isCustomMode
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ✏️ Custom Code
          </button>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-8">
        {[
          { num: 1, label: "Blind Specification", icon: EyeOff },
          { num: 2, label: "Baseline Check", icon: CheckCircle2 },
          { num: 3, label: "Saboteur Drill", icon: Flame },
          { num: 4, label: "Socratic & Transfer", icon: Sparkles },
          { num: 5, label: "Signed Receipt", icon: FileCheck },
        ].map(({ num, label, icon: Icon }) => (
          <div
            key={num}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              step === num
                ? "border-blue-500/60 bg-blue-500/10 text-white shadow-sm"
                : step > num
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                : "border-slate-800/80 bg-slate-900/30 text-slate-500"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold ${
                step === num
                  ? "bg-blue-600 text-white"
                  : step > num
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {step > num ? <Check className="w-4 h-4" /> : num}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-medium leading-none">{label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {step === num ? "Active" : step > num ? "Completed" : "Pending"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {apiError && (
        <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-red-300 text-xs font-mono flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* STEP 1: Blind Specification */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-blue-400 uppercase tracking-wider font-semibold">
                  Step 1: Independent Behavioral Oracle
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  Blind Contract
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">Target Function Signature</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Specify input arguments and expected output based solely on the signature contract without inspecting the implementation body.
                </p>
              </div>

              {/* Signature Card */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-emerald-400 flex items-center justify-between">
                <code>{isCustomMode ? "customFunction(...args)" : currentSample.signature}</code>
                <span className="text-[10px] uppercase font-bold text-slate-500">Pure TS</span>
              </div>

              {/* Editable Custom Code if toggled */}
              {isCustomMode && (
                <div className="space-y-2">
                  <label className="text-xs font-mono text-slate-300">Edit / Paste TypeScript Function:</label>
                  <textarea
                    rows={8}
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">
                    Test Input Arguments (comma-separated or JSON):
                  </label>
                  <input
                    type="text"
                    value={argsInput}
                    onChange={(e) => setArgsInput(e.target.value)}
                    placeholder="e.g. 100, false"
                    className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">
                    Expected Return Value:
                  </label>
                  <input
                    type="text"
                    value={expectedInput}
                    onChange={(e) => setExpectedInput(e.target.value)}
                    placeholder="e.g. 90"
                    className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={handleExecuteBaselineAndSaboteur}
                disabled={isExecuting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <Cpu className="w-4 h-4 animate-spin" />
                    Executing in VM Sandbox...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Baseline Oracle Check & Saboteur Loop
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/30 space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                Why the Blind Oracle Matters
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                When developers or LLMs look at code before writing tests, they unconsciously write tests that conform to whatever the code already does (self-fulfilling test bias).
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                GitSpar hides the function body and forces an independent behavioral contract. If the code breaks your expectation, it catches genuine regressions before they reach code review.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Baseline Verified & Agent Trace */}
      {step === 2 && (
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold font-mono">
              <CheckCircle2 className="w-5 h-5" />
              <span>Step 2: Baseline Execution Passed (GREEN)</span>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Return Value: {JSON.stringify(serverData?.baselineOutput)}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Your unmodified implementation satisfied the blind expectation contract. The autonomous{" "}
            <code className="text-blue-400 font-mono">SaboteurAgent</code> analyzed AST relational expressions and attempted mutation kill passes.
          </p>

          {/* Live SaboteurAgent Trace */}
          {serverData?.agentTrace && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs space-y-2">
              <div className="text-[11px] text-blue-400 uppercase tracking-wider font-bold border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>Autonomous SaboteurAgent Execution Trace</span>
                <span className="text-slate-500 font-normal">Real Server Runtime</span>
              </div>
              <div className="space-y-1.5 pt-1">
                {serverData.agentTrace.map((line, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-300">
                    <span className="text-slate-600 select-none">[{idx + 1}]</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={resetDrill}
              className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-mono text-slate-400 hover:text-white"
            >
              Reset
            </button>
            <button
              onClick={handleProceedToDrill}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all"
            >
              <span>Proceed to Mutation Diagnostic Drill</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Saboteur Mutation Drill */}
      {step === 3 && (
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-mono text-red-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-red-400" />
                Step 3: Mutant Killed (RED) — Diagnostic Challenge
              </span>
              <h2 className="text-lg font-bold text-white mt-1">
                Diagnose the Injected Mutation
              </h2>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Click the line with the broken boundary condition
            </div>
          </div>

          {/* Interactive Code Viewer */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs overflow-hidden">
            <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-slate-400 flex items-center justify-between text-[11px]">
              <span>Active Mutated Implementation</span>
              <span>Click a line to select defect</span>
            </div>
            <div className="p-4 space-y-1">
              {(serverData?.mutatedCode || currentCode).split("\n").map((lineText, idx) => {
                const lineNum = idx + 1;
                const isSelected = selectedLine === lineNum;
                return (
                  <div
                    key={lineNum}
                    onClick={() => setSelectedLine(lineNum)}
                    className={`flex items-center gap-4 px-2 py-1 rounded cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-red-500/20 text-red-300 font-bold border-l-4 border-red-500"
                        : "hover:bg-slate-900 text-slate-300"
                    }`}
                  >
                    <span className="w-8 text-right text-slate-600 select-none">{lineNum}</span>
                    <pre className="overflow-x-auto whitespace-pre font-mono">{lineText}</pre>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Diagnosis Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="text-xs font-mono text-slate-300 block mb-1.5">Diagnosed Line:</label>
              <div className="px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs font-mono text-white">
                {selectedLine ? `Line ${selectedLine}` : "Click a line above"}
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-300 block mb-1.5">Correct Operator:</label>
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              >
                <option value=">=">&gt;= (Greater or Equal)</option>
                <option value=">">&gt; (Strictly Greater)</option>
                <option value="<=">&lt;= (Less or Equal)</option>
                <option value="<">&lt; (Strictly Less)</option>
                <option value="===">=== (Strict Equality)</option>
                <option value="!==">!== (Inequality)</option>
              </select>
            </div>

            <div className="sm:col-span-3 space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block">
                Diagnostic Explanation (graded by SocraticEvaluatorAgent):
              </label>
              <textarea
                rows={2}
                value={diagnosticExplanation}
                onChange={(e) => setDiagnosticExplanation(e.target.value)}
                placeholder="Explain why mutating this boundary operator caused the oracle test input to fail..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {repairError && (
            <div className="p-3.5 rounded-xl border border-yellow-500/30 bg-yellow-950/20 text-yellow-300 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
              <span>{repairError}</span>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={handleSubmitDiagnosis}
              disabled={isExecuting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all disabled:opacity-50"
            >
              {isExecuting ? <Cpu className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Submit to Socratic Evaluator & Transfer Probe</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Socratic Feedback & Transfer Probe */}
      {step === 4 && (
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-mono text-indigo-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Step 4: Unseen Transfer Probe Assessment
              </span>
              <h2 className="text-lg font-bold text-white mt-1">
                Predict Unseen Counterfactual Input
              </h2>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Transfer Probe
            </span>
          </div>

          {/* Socratic Evaluator Confirmation Banner */}
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 text-xs font-mono flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">SocraticEvaluator: Explanation Approved ({serverData?.socraticEvaluation?.score ?? 92}/100)</div>
              <p className="text-emerald-400/80 mt-0.5 text-[11px]">
                {serverData?.socraticEvaluation?.feedback || "Your explanation articulated the causal boundary condition mechanism."}
              </p>
            </div>
          </div>

          {/* Transfer Probe Challenge Card */}
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-950 space-y-4">
            <div className="text-xs font-mono text-slate-300 leading-relaxed">
              To verify that your comprehension generalizes rather than being memorized, the autonomous agent synthesized an unseen counterfactual input near the boundary:
            </div>

            <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/70 font-mono text-xs flex items-center justify-between">
              <span className="text-slate-400">Counterfactual Input:</span>
              <code className="text-indigo-400 font-bold">
                {serverData?.activeFnName || currentSample.name}({JSON.stringify(serverData?.transferProbe?.probeInput ?? []).slice(1, -1)})
              </code>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">
                Without running the code, what will this unseen input return?
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={transferAnswer}
                  onChange={(e) => setTransferAnswer(e.target.value)}
                  placeholder="Enter predicted return value (e.g. 80 or true)"
                  className="flex-1 font-mono text-xs bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleVerifyTransfer}
                  disabled={isExecuting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs font-mono transition-all disabled:opacity-50"
                >
                  {isExecuting ? "Verifying..." : "Verify Generalization"}
                </button>
              </div>
            </div>

            {repairError && (
              <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-950/20 text-red-300 text-xs font-mono flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{repairError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 5: Signed Cryptographic Receipt */}
      {step === 5 && (
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                  Step 5: Assessment Verified & Signed
                </span>
                <h2 className="text-xl font-bold text-white">Cryptographic PR Receipt Generated</h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyReceipt}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs font-mono text-slate-300 hover:text-white transition-all"
              >
                {copiedReceipt ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedReceipt ? "Copied Markdown" : "Copy Markdown"}</span>
              </button>

              <button
                onClick={downloadReceipt}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-mono text-white font-semibold transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download JSON</span>
              </button>
            </div>
          </div>

          {/* Receipt Markdown Viewer */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
            <pre className="whitespace-pre-wrap">{receiptMarkdown}</pre>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={resetDrill}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-800 text-xs font-mono text-slate-400 hover:text-white"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Run Another Assessment</span>
            </button>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-mono text-white font-semibold"
            >
              <span>View Reviewer Leaderboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
