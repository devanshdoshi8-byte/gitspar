"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";

interface SamplePreset {
  name: string;
  file: string;
  signature: string;
  defaultArgs: string;
  defaultExpected: string;
  mutatedLine: number;
  originalCode: string[];
  mutatedCode: string[];
  originalOp: string;
  mutatedOp: string;
  explanationHint: string;
}

const SAMPLES: SamplePreset[] = [
  {
    name: "calculateTierDiscount",
    file: "examples/checkoutDiscount.ts",
    signature: "calculateTierDiscount(orderTotal: number, isStudent: boolean): number",
    defaultArgs: "100, false",
    defaultExpected: "90",
    mutatedLine: 2,
    originalCode: [
      "export function calculateTierDiscount(orderTotal: number, isStudent: boolean): number {",
      "  if (orderTotal >= 100) {",
      "    return orderTotal * 0.9;",
      "  }",
      "  return isStudent ? orderTotal * 0.95 : orderTotal;",
      "}",
    ],
    mutatedCode: [
      "export function calculateTierDiscount(orderTotal: number, isStudent: boolean): number {",
      "  if (orderTotal > 100) { /* MUTATED OPERATOR: >= became > */",
      "    return orderTotal * 0.9;",
      "  }",
      "  return isStudent ? orderTotal * 0.95 : orderTotal;",
      "}",
    ],
    originalOp: ">=",
    mutatedOp: ">",
    explanationHint: "Boundary condition flipped from >= to > so orderTotal 100 was not discounted",
  },
  {
    name: "isSessionValid",
    file: "src/authSession.ts",
    signature: "isSessionValid(now: number, expiresAt: number): boolean",
    defaultArgs: "1000, 1000",
    defaultExpected: "false",
    mutatedLine: 2,
    originalCode: [
      "export function isSessionValid(now: number, expiresAt: number): boolean {",
      "  if (now >= expiresAt) {",
      "    return false;",
      "  }",
      "  return true;",
      "}",
    ],
    mutatedCode: [
      "export function isSessionValid(now: number, expiresAt: number): boolean {",
      "  if (now > expiresAt) { /* MUTATED OPERATOR: >= became > */",
      "    return false;",
      "  }",
      "  return true;",
      "}",
    ],
    originalOp: ">=",
    mutatedOp: ">",
    explanationHint: "Expired token at exact timestamp now === expiresAt was treated as still valid",
  },
];

export default function DemoPage() {
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const sample = SAMPLES[selectedSampleIndex];

  // Steps: 1 = Blind Oracle, 2 = Baseline Check, 3 = Mutation Red, 4 = Repair, 5 = Receipt
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [argsInput, setArgsInput] = useState(sample.defaultArgs);
  const [expectedInput, setExpectedInput] = useState(sample.defaultExpected);
  const [isExecuting, setIsExecuting] = useState(false);

  // Diagnosis & repair state
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<string>(">");
  const [diagnosticExplanation, setDiagnosticExplanation] = useState("");
  const [repairError, setRepairError] = useState<string | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  // Reset when sample changes
  const switchSample = (index: number) => {
    setSelectedSampleIndex(index);
    const nextSample = SAMPLES[index];
    setArgsInput(nextSample.defaultArgs);
    setExpectedInput(nextSample.defaultExpected);
    setStep(1);
    setSelectedLine(null);
    setSelectedOperator(">");
    setDiagnosticExplanation("");
    setRepairError(null);
  };

  const handleRunBaseline = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setStep(2);
    }, 700);
  };

  const handleProceedToMutation = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setStep(3);
    }, 800);
  };

  const handleValidateRepair = () => {
    setRepairError(null);
    if (selectedLine !== sample.mutatedLine) {
      setRepairError(`Line ${selectedLine} is not the mutated defect. Look for the boundary comparison.`);
      return;
    }
    if (selectedOperator !== sample.originalOp) {
      setRepairError(`Incorrect operator '${selectedOperator}'. The code originally tested inclusive boundary.`);
      return;
    }
    if (!diagnosticExplanation.trim() || diagnosticExplanation.length < 10) {
      setRepairError("Please write at least a 1-sentence diagnostic explanation explaining the defect.");
      return;
    }

    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setStep(5);
    }, 700);
  };

  const generatedSha = "7f9a2b8e4c1d6e3f5a0b9c8d7e6f5a4b3c2d1e0f8a9b7c6d5e4f3a2b1c0d9e8f";
  const baseSha = "a1b2c3d4e5f67890123456789abcdef012345678";

  const receiptMarkdown = `<!-- GITSPAR_RECEIPT_START -->
## 🛡️ GitSpar Comprehension Receipt
- **Target Function:** \`${sample.name}\` (\`${sample.file}\`)
- **Assessment Mode:** \`mutation_drill\` (Clean-Room Boundary Verification)
- **Base Commit:** \`${baseSha}\`
- **Working Tree Diff SHA-256:** \`${generatedSha}\`
- **Diagnosed Line:** Line ${sample.mutatedLine}
- **Operator Restored:** \`${sample.originalOp}\` (mutated from \`${sample.mutatedOp}\`)
- **Diagnostic Proof:** "${diagnosticExplanation}"
- **Status:** ✅ VERIFIED COMPREHENSION
<!-- GITSPAR_RECEIPT_END -->`;

  const copyReceipt = () => {
    navigator.clipboard.writeText(receiptMarkdown);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  const downloadReceiptJson = () => {
    const data = {
      version: "0.3.0",
      timestamp: new Date().toISOString(),
      baseCommitSha: baseSha,
      workingDiffSha256: generatedSha,
      assessedFunction: sample.name,
      filePath: sample.file,
      assessmentMode: "mutation_drill",
      mutatedLine: sample.mutatedLine,
      originalOperator: sample.originalOp,
      mutatedOperator: sample.mutatedOp,
      diagnosticProof: diagnosticExplanation,
      passed: true,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "receipt.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono mb-2">
            <Cpu className="w-3.5 h-3.5" />
            Clean-Room Verification Sandbox
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Live GitSpar Mutation Simulator
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Experience the complete 4-step diagnostic verification loop directly in your browser.
          </p>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {SAMPLES.map((s, idx) => (
            <button
              key={s.name}
              onClick={() => switchSample(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                selectedSampleIndex === idx
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-8">
        {[
          { num: 1, label: "Blind Oracle", icon: EyeOff },
          { num: 2, label: "Baseline Run", icon: CheckCircle2 },
          { num: 3, label: "Mutation Drill", icon: Flame },
          { num: 4, label: "Diagnose & Fix", icon: Code2 },
          { num: 5, label: "PR Receipt", icon: FileCheck },
        ].map((s) => {
          const Icon = s.icon;
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <div
              key={s.num}
              className={`p-3 rounded-xl border transition-all flex items-center gap-2.5 ${
                isActive
                  ? "border-blue-500 bg-blue-950/40 text-blue-300 shadow-md shadow-blue-500/10"
                  : isDone
                  ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-400"
                  : "border-slate-800/80 bg-slate-900/40 text-slate-500"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : isDone
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <div className="text-xs font-medium truncate">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Step Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Interactive Playground */}
        <div className="lg:col-span-7 space-y-6">
          {/* STEP 1: BLIND ORACLE */}
          {step === 1 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
              <div className="flex items-center gap-2.5 text-blue-400">
                <EyeOff className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Step 1: Blind Independent Oracle</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                The implementation body is intentionally hidden. Inspect only the function signature, then provide
                boundary test inputs and expected output to verify you understand its contract.
              </p>

              {/* Function Signature Box */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-sm text-blue-300 overflow-x-auto">
                <div className="text-[11px] text-slate-500 mb-1">// Signature extracted by ts-morph</div>
                <code>{sample.signature}</code>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Test Arguments (JSON or comma-separated)
                  </label>
                  <input
                    type="text"
                    value={argsInput}
                    onChange={(e) => setArgsInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    placeholder="e.g. 100, false"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Suggested boundary test: <code className="text-slate-400">{sample.defaultArgs}</code>
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Expected Return Value</label>
                  <input
                    type="text"
                    value={expectedInput}
                    onChange={(e) => setExpectedInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    placeholder="e.g. 90"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Expected output: <code className="text-slate-400">{sample.defaultExpected}</code>
                  </span>
                </div>
              </div>

              <button
                onClick={handleRunBaseline}
                disabled={isExecuting || !argsInput || !expectedInput}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
              >
                {isExecuting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Executing Vitest Baseline Oracle...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Execute Baseline Oracle Probe</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: BASELINE PASSED */}
          {step === 2 && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 space-y-5">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
                <h3 className="text-base font-bold text-white">Step 2: Baseline Execution Passed (GREEN)</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your independent oracle passed against the unmutated original source code! The test framework confirmed
                that <code className="text-emerald-300 font-mono font-semibold">{sample.name}({argsInput})</code> returned{" "}
                <code className="text-emerald-300 font-mono font-semibold">{expectedInput}</code>.
              </p>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
                <div className="text-emerald-400 font-semibold">✓ test/baseline.spec.ts (1 test passed)</div>
                <div className="text-slate-500">Duration: 18ms</div>
                <div className="text-slate-400">Assertion: expect({sample.name}({argsInput})).toEqual({expectedInput})</div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleProceedToMutation}
                  disabled={isExecuting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-600/20"
                >
                  {isExecuting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Injecting AST Mutation...</span>
                    </>
                  ) : (
                    <>
                      <Flame className="w-4 h-4" />
                      <span>Inject AST Boundary Mutant (Step 3)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white text-xs"
                >
                  Edit Oracle
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 & 4: MUTATION & REPAIR */}
          {(step === 3 || step === 4) && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-amber-400">
                  <Flame className="w-5 h-5" />
                  <h3 className="text-base font-bold text-white">
                    {step === 3 ? "Step 3: Mutation Drill Activated (RED)" : "Step 4: Interactive Diagnosis & Repair"}
                  </h3>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                  Mutant Injected
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                GitSpar injected a boundary operator flip. The test suite failed (RED). Click on the line with the
                defect to repair it.
              </p>

              {/* Simulated Code Editor with clickable lines */}
              <div className="rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-hidden">
                <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{sample.file}</span>
                  <span className="text-slate-500">Click line to select defect</span>
                </div>
                <div className="p-3 divide-y divide-transparent">
                  {sample.mutatedCode.map((line, idx) => {
                    const lineNum = idx + 1;
                    const isSelected = selectedLine === lineNum;
                    const isFaultyLine = lineNum === sample.mutatedLine;
                    return (
                      <div
                        key={lineNum}
                        onClick={() => {
                          setSelectedLine(lineNum);
                          if (step === 3) setStep(4);
                        }}
                        className={`flex items-center gap-3 px-2 py-1.5 rounded cursor-pointer transition-all ${
                          isSelected
                            ? "bg-blue-600/20 border border-blue-500/50 text-white"
                            : isFaultyLine && step === 4
                            ? "bg-amber-950/30 text-amber-200 hover:bg-amber-900/40"
                            : "hover:bg-slate-900 text-slate-300"
                        }`}
                      >
                        <span className="w-6 text-right select-none text-slate-600 text-[10px]">{lineNum}</span>
                        <code className="flex-1 font-mono">{line}</code>
                        {isSelected && <span className="text-[10px] text-blue-400 uppercase font-bold">Selected</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Diagnosis Controls */}
              {step === 4 && (
                <div className="p-4 rounded-xl border border-blue-500/30 bg-slate-950/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-white">Selected Line: </span>
                      <span className="text-xs font-mono font-bold text-blue-400">Line {selectedLine}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Correct Operator:</span>
                      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                        {[">=", ">", "<=", "<", "==="].map((op) => (
                          <button
                            key={op}
                            onClick={() => setSelectedOperator(op)}
                            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                              selectedOperator === op
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            {op}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      1-Sentence Diagnostic Explanation (Required for PR Receipt)
                    </label>
                    <input
                      type="text"
                      value={diagnosticExplanation}
                      onChange={(e) => setDiagnosticExplanation(e.target.value)}
                      placeholder="e.g. Boundary condition flipped from >= to > so 100 was not discounted"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500">
                      <span>Provide clear rationale proving understanding</span>
                      <button
                        onClick={() => setDiagnosticExplanation(sample.explanationHint)}
                        className="text-blue-400 hover:underline"
                      >
                        Use recommended hint
                      </button>
                    </div>
                  </div>

                  {repairError && (
                    <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{repairError}</span>
                    </div>
                  )}

                  <button
                    onClick={handleValidateRepair}
                    disabled={isExecuting}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                  >
                    {isExecuting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Verifying Repair with Vitest...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm Diagnosis &amp; Generate PR Receipt</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-3">
                    Click on the line above where the comparison operator was mutated to begin repair.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: RECEIPT GENERATED */}
          {step === 5 && (
            <div className="rounded-2xl border border-emerald-500/40 bg-slate-900/70 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <Shield className="w-6 h-6" />
                  <div>
                    <h3 className="text-base font-bold text-white">Comprehension Verified!</h3>
                    <span className="text-xs text-emerald-400 font-mono">Receipt Generated for Git Pull Request</span>
                  </div>
                </div>
                <button
                  onClick={() => switchSample(selectedSampleIndex)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs font-mono"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>

              {/* Receipt Visual Card */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 space-y-2.5 shadow-inner">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                  <span className="text-white font-bold">.gitspar/receipt.json</span>
                  <span className="text-emerald-400 font-semibold">STATUS: VERIFIED</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Function: </span>
                    <span className="text-white">{sample.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Mode: </span>
                    <span className="text-blue-400">mutation_drill</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Mutated Line: </span>
                    <span className="text-amber-400">Line {sample.mutatedLine}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Restored: </span>
                    <span className="text-emerald-400">{sample.originalOp}</span>
                  </div>
                </div>
                <div className="text-[11px]">
                  <span className="text-slate-500">Diagnostic Proof: </span>
                  <span className="text-slate-200 italic">&ldquo;{diagnosticExplanation}&rdquo;</span>
                </div>
                <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 truncate">
                  SHA-256: {generatedSha}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={copyReceipt}
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20"
                >
                  {copiedReceipt ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied Markdown!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy PR Receipt Markdown</span>
                    </>
                  )}
                </button>
                <button
                  onClick={downloadReceiptJson}
                  className="py-2 px-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download receipt.json</span>
                </button>
                <Link
                  href="/dashboard"
                  className="py-2 px-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <span>View Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Terminal Output Log */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 flex-1 flex flex-col shadow-2xl overflow-hidden min-h-[420px]">
            {/* Terminal Top Bar */}
            <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="text-slate-400 ml-2 font-medium">terminal — vitest runner</span>
              </div>
              <Terminal className="w-4 h-4 text-slate-500" />
            </div>

            {/* Terminal Body */}
            <div className="p-4 font-mono text-[11px] sm:text-xs leading-relaxed space-y-3 flex-1 overflow-y-auto text-slate-300">
              <div className="text-slate-500">$ gitspar --interactive</div>
              <div className="text-blue-400">
                [GitSpar v0.3.0] Analyzing working tree against origin/master...
              </div>

              {step >= 1 && (
                <div className="space-y-1">
                  <div className="text-slate-400">
                    &gt; Discovered eligible function: <span className="text-white font-bold">{sample.name}</span>
                  </div>
                  <div className="text-slate-400">
                    &gt; Target file: <span className="text-slate-300">{sample.file}</span>
                  </div>
                  <div className="text-indigo-400">&gt; Waiting for Blind Independent Oracle inputs...</div>
                </div>
              )}

              {step >= 2 && (
                <div className="space-y-1 border-t border-slate-900 pt-2">
                  <div className="text-slate-400">
                    &gt; Running isolated Vitest check on unmodified function...
                  </div>
                  <div className="text-emerald-400 font-bold">
                    [PASS] Oracle check succeeded! Baseline returned expected value: {expectedInput}
                  </div>
                </div>
              )}

              {step >= 3 && (
                <div className="space-y-1 border-t border-slate-900 pt-2">
                  <div className="text-amber-400">
                    &gt; Injecting boundary AST mutant on line {sample.mutatedLine}...
                  </div>
                  <div className="text-slate-400">
                    &gt; Operator flipped: {sample.originalOp} -&gt; {sample.mutatedOp}
                  </div>
                  <div className="text-red-400 font-bold">
                    [FAIL] Vitest runner failed as expected! Mutant is ALIVE.
                  </div>
                  <div className="text-red-300/80 text-[10px] pl-2 border-l-2 border-red-500">
                    AssertionError: expected {expectedInput} // Object.is equality
                  </div>
                </div>
              )}

              {step >= 4 && (
                <div className="space-y-1 border-t border-slate-900 pt-2">
                  <div className="text-blue-400">&gt; Awaiting developer diagnosis and repair...</div>
                  {selectedLine && (
                    <div className="text-slate-300">
                      &gt; Candidate line selected: {selectedLine} (operator: {selectedOperator})
                    </div>
                  )}
                </div>
              )}

              {step === 5 && (
                <div className="space-y-1 border-t border-slate-900 pt-2">
                  <div className="text-emerald-400 font-bold">
                    [PASS] Vitest runner repaired! Mutant KILLED.
                  </div>
                  <div className="text-emerald-300">
                    &gt; Verified change comprehension. Saved .gitspar/receipt.json.
                  </div>
                  <div className="text-slate-400 text-[10px]">&gt; Exit code 0</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
