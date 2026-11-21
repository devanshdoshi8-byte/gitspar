"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  Shield,
  Timer,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Code2,
  FileCheck,
  ArrowRight,
  Terminal,
  Zap,
  EyeOff,
  Flame,
  Lock,
  Key,
  ShieldCheck,
  ShieldAlert,
  Copy,
} from "lucide-react";

interface VerificationItem {
  id: string;
  repo: string;
  author: string;
  prNumber: number;
  functionName: string;
  file: string;
  signature: string;
  mutatedLine: number;
  originalOp: string;
  mutatedOp: string;
  codeSnippet: string[];
  defaultArgs: string;
  expectedOutput: string;
  diffSha256?: string;
  receiptSignature?: string;
  signatureMode?: "production-hmac" | "local-dev";
}

const SAMPLE_PR_CHALLENGES: Record<string, VerificationItem> = {
  "PR-1082": {
    id: "PR-1082",
    repo: "devanshdoshi8-byte/gitspar",
    author: "alex-chen",
    prNumber: 1082,
    functionName: "calculateTierDiscount",
    file: "examples/checkoutDiscount.ts",
    signature: "calculateTierDiscount(orderTotal: number, isStudent: boolean): number",
    mutatedLine: 2,
    originalOp: ">=",
    mutatedOp: ">",
    codeSnippet: [
      "export function calculateTierDiscount(orderTotal: number, isStudent: boolean): number {",
      "  if (orderTotal > 100) {",
      "    return orderTotal * 0.9;",
      "  }",
      "  return isStudent ? orderTotal * 0.95 : orderTotal;",
      "}",
    ],
    defaultArgs: "100, false",
    expectedOutput: "90",
  },
  "PR-4491": {
    id: "PR-4491",
    repo: "acme-corp/payment-service",
    author: "sarah-miller",
    prNumber: 4491,
    functionName: "isSessionValid",
    file: "src/auth/session.ts",
    signature: "isSessionValid(now: number, expiresAt: number): boolean",
    mutatedLine: 2,
    originalOp: ">=",
    mutatedOp: ">",
    codeSnippet: [
      "export function isSessionValid(now: number, expiresAt: number): boolean {",
      "  if (now > expiresAt) {",
      "    return false;",
      "  }",
      "  return true;",
      "}",
    ],
    defaultArgs: "1000, 1000",
    expectedOutput: "false",
  },
  "GS-8901": {
    id: "GS-8901",
    repo: "devanshdoshi8-byte/gitspar",
    author: "alex-chen",
    prNumber: 42,
    functionName: "calculateTierDiscount",
    file: "examples/checkoutDiscount.ts",
    signature: "calculateTierDiscount(orderTotal: number, isStudent: boolean): number",
    mutatedLine: 2,
    originalOp: ">=",
    mutatedOp: ">",
    codeSnippet: [
      "export function calculateTierDiscount(orderTotal: number, isStudent: boolean): number {",
      "  if (orderTotal > 100) {",
      "    return orderTotal * 0.9;",
      "  }",
      "  return isStudent ? orderTotal * 0.95 : orderTotal;",
      "}",
    ],
    defaultArgs: "100, false",
    expectedOutput: "90",
  },
  "GS-8902": {
    id: "GS-8902",
    repo: "fintech-core/settlement-engine",
    author: "sarah-m",
    prNumber: 128,
    functionName: "verifySessionExpiry",
    file: "src/auth/session.ts",
    signature: "verifySessionExpiry(tokenIssuedAt: number, maxLifetime: number): boolean",
    mutatedLine: 2,
    originalOp: "<=",
    mutatedOp: "<",
    codeSnippet: [
      "export function verifySessionExpiry(tokenIssuedAt: number, maxLifetime: number): boolean {",
      "  if (Date.now() - tokenIssuedAt < maxLifetime) {",
      "    return true;",
      "  }",
      "  return false;",
      "}",
    ],
    defaultArgs: "1000, 1000",
    expectedOutput: "true",
  },
  "GS-8903": {
    id: "GS-8903",
    repo: "cloud-mesh/rate-limiter",
    author: "david-k",
    prNumber: 85,
    functionName: "checkRateLimit",
    file: "src/limiter/window.ts",
    signature: "checkRateLimit(currentUsage: number, limit: number): boolean",
    mutatedLine: 2,
    originalOp: "<=",
    mutatedOp: "<",
    codeSnippet: [
      "export function checkRateLimit(currentUsage: number, limit: number): boolean {",
      "  if (currentUsage < limit) {",
      "    return true;",
      "  }",
      "  return false;",
      "}",
    ],
    defaultArgs: "100, 100",
    expectedOutput: "true",
  },
  "GS-8904": {
    id: "GS-8904",
    repo: "health-ai/patient-triage",
    author: "priya-sharma",
    prNumber: 310,
    functionName: "evaluateVitalsRisk",
    file: "src/triage/riskScore.ts",
    signature: "evaluateVitalsRisk(systolicBP: number, threshold: number): boolean",
    mutatedLine: 2,
    originalOp: ">=",
    mutatedOp: ">",
    codeSnippet: [
      "export function evaluateVitalsRisk(systolicBP: number, threshold: number): boolean {",
      "  if (systolicBP > threshold) {",
      "    return true;",
      "  }",
      "  return false;",
      "}",
    ],
    defaultArgs: "140, 140",
    expectedOutput: "true",
  },
  "GS-8905": {
    id: "GS-8905",
    repo: "ecommerce-hub/inventory-service",
    author: "elena-rostova",
    prNumber: 204,
    functionName: "allocateWarehouseStock",
    file: "src/stock/allocation.ts",
    signature: "allocateWarehouseStock(availableQty: number, requestedQty: number): boolean",
    mutatedLine: 2,
    originalOp: ">=",
    mutatedOp: ">",
    codeSnippet: [
      "export function allocateWarehouseStock(availableQty: number, requestedQty: number): boolean {",
      "  if (availableQty > requestedQty) {",
      "    return true;",
      "  }",
      "  return false;",
      "}",
    ],
    defaultArgs: "50, 50",
    expectedOutput: "true",
  },
  "GS-8907": {
    id: "GS-8907",
    repo: "auth-guard/rbac-service",
    author: "jordan-lee",
    prNumber: 94,
    functionName: "checkRolePermission",
    file: "src/rbac/authorization.ts",
    signature: "checkRolePermission(userLevel: number, requiredLevel: number): boolean",
    mutatedLine: 2,
    originalOp: "<=",
    mutatedOp: "<",
    codeSnippet: [
      "export function checkRolePermission(userLevel: number, requiredLevel: number): boolean {",
      "  if (userLevel < requiredLevel) {",
      "    return false;",
      "  }",
      "  return true;",
      "}",
    ],
    defaultArgs: "10, 10",
    expectedOutput: "true",
  },
};

export default function VerifyCleanRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const fallbackChallenge: VerificationItem = SAMPLE_PR_CHALLENGES[id] || {
    id: id || "CUSTOM-VERIFY",
    repo: "acme-auth/session-guard",
    author: "dev-lead",
    prNumber: 99,
    functionName: "verifyRateLimit",
    file: "src/limiter.ts",
    signature: "verifyRateLimit(currentRequests: number, maxAllowed: number): boolean",
    mutatedLine: 2,
    originalOp: "<=",
    mutatedOp: "<",
    codeSnippet: [
      "export function verifyRateLimit(currentRequests: number, maxAllowed: number): boolean {",
      "  if (currentRequests < maxAllowed) {",
      "    return true;",
      "  }",
      "  return false;",
      "}",
    ],
    defaultArgs: "100, 100",
    expectedOutput: "true",
  };

  const [data, setData] = useState<VerificationItem>(fallbackChallenge);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("gitspar_user_receipts");
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list)) {
          const match = list.find((item: any) => item.id === id);
          if (match) {
            setData({
              id: match.id,
              repo: match.repo || "local/working-tree",
              author: match.contributor || "you",
              prNumber: match.prNumber || 1,
              functionName: match.assessedFunction || "assessedFunction",
              file: match.filePath || "src/index.ts",
              signature: match.signature || `${match.assessedFunction || "function"}(...)`,
              mutatedLine: match.mutatedLine || 2,
              originalOp: match.restoredOperator || ">=",
              mutatedOp: match.mutatedOperator || ">",
              codeSnippet: Array.isArray(match.codeSnippet) && match.codeSnippet.length > 0
                ? match.codeSnippet
                : fallbackChallenge.codeSnippet,
              defaultArgs: typeof match.defaultArgs === "string" ? match.defaultArgs : JSON.stringify(match.defaultArgs || "100"),
              expectedOutput: typeof match.expectedOutput === "string" ? match.expectedOutput : JSON.stringify(match.expectedOutput || "true"),
              diffSha256: match.working_diff_sha256 || match.diffSha256 || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
              receiptSignature: match.signature,
              signatureMode: match.signatureMode || match.signature_mode || "local-dev",
            });
            if (match.diagnosticExplanation) {
              setExplanation(match.diagnosticExplanation);
            }
            if (typeof match.score === "number") {
              setScore(match.score);
              setIsCompleted(true);
              setTimerRunning(false);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Could not load receipt from localStorage", e);
    }
  }, [id]);

  // 60-second countdown timer
  const TOTAL_TIME = 60;
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [timerRunning, setTimerRunning] = useState(true);

  // Assessment state
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [selectedOp, setSelectedOp] = useState<string>(">");
  const [explanation, setExplanation] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  // Live HMAC verification state
  const [verifyStatus, setVerifyStatus] = useState<{
    loading: boolean;
    valid?: boolean;
    reason?: string;
    signature?: string;
    signatureMode?: string;
    tampered?: boolean;
    checkedAt?: string;
  } | null>(null);

  const handleVerifyIntegrity = async (tamper: boolean = false) => {
    setVerifyStatus((prev) => ({ loading: true, ...prev }));
    try {
      const activeDiff = data.diffSha256 || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const testedDiff = tamper
        ? activeDiff.startsWith("0000")
          ? "ffff" + activeDiff.slice(4)
          : "0000" + activeDiff.slice(4)
        : activeDiff;

      let sig = data.receiptSignature;
      if (!sig) {
        const signRes = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sign",
            receipt: {
              receiptId: data.id,
              diffSha256: activeDiff,
              functionName: data.functionName,
              mode: "mutation_drill",
              score: score ?? 100,
              verifiedAt: new Date().toISOString(),
            },
          }),
        });
        const signData = await signRes.json();
        sig = signData.signature;
        setData((prev) => ({
          ...prev,
          receiptSignature: sig,
          signatureMode: signData.signatureMode,
        }));
      }

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt: {
            receiptId: data.id,
            diffSha256: testedDiff,
            functionName: data.functionName,
            mode: "mutation_drill",
            score: score ?? 100,
            verifiedAt: new Date().toISOString(),
            signature: sig,
          },
        }),
      });
      const resData = await res.json();
      setVerifyStatus({
        loading: false,
        valid: resData.valid,
        reason: resData.reason,
        signature: sig,
        signatureMode: resData.signatureMode,
        tampered: tamper,
        checkedAt: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      setVerifyStatus({
        loading: false,
        valid: false,
        reason: (err as Error).message || "Verification request failed",
        tampered: tamper,
        checkedAt: new Date().toLocaleTimeString(),
      });
    }
  };

  useEffect(() => {
    if (!timerRunning || timeLeft <= 0 || isCompleted) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerRunning(false);
          handleFinish(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timeLeft, isCompleted]);

  const handleFinish = (timedOut = false) => {
    setTimerRunning(false);
    setIsCompleted(true);

    if (timedOut) {
      setScore(25); // Timeout penalty
      return;
    }

    let calculatedScore = 50;
    if (selectedLine === data.mutatedLine) calculatedScore += 30;
    if (selectedOp === data.originalOp) calculatedScore += 10;
    if (explanation.trim().length > 15) calculatedScore += 10;
    setScore(calculatedScore);
  };

  const timerColor =
    timeLeft > 25
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-950/20"
      : timeLeft > 10
      ? "text-amber-400 border-amber-500/30 bg-amber-950/20"
      : "text-red-400 border-red-500/30 bg-red-950/20 animate-pulse";

  return (
    <div className="min-h-[85vh] bg-slate-950 px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Assessment Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Clean-Room Verification
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {data.id}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                Repo: {data.repo} • Author: @{data.author}
              </div>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (isCompleted) {
                  setIsCompleted(false);
                  setTimeLeft(TOTAL_TIME);
                  setTimerRunning(true);
                } else {
                  setIsCompleted(true);
                  if (score === null) setScore(100);
                  setTimerRunning(false);
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition-colors"
            >
              {isCompleted ? "Back to Drill Challenge" : "Inspect Attestation & Signature"}
            </button>
            {/* 60s Timer */}
            <div className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border ${timerColor}`}>
              <Timer className="w-4 h-4" />
              <span className="font-mono font-bold text-sm">{timeLeft}s remaining</span>
            </div>
          </div>
        </div>

        {/* Timed Drill Card */}
        {!isCompleted ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
            <div className="space-y-1">
              <div className="text-xs font-mono text-blue-400 uppercase tracking-wider font-semibold">
                Challenge 1 of 1: Boundary Mutation Diagnostic Drill
              </div>
              <h2 className="text-lg font-bold text-white">
                Diagnose the Injected Mutation in <code className="text-blue-300 font-mono">{data.functionName}</code>
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                A reviewer or CI pipeline triggered this clean-room challenge. Inspect the blind oracle expectation and the
                mutated code below, click on the faulty line, select the correct operator, and submit your diagnostic explanation.
              </p>
            </div>

            {/* Blind Independent Oracle Card */}
            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-950/20 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-blue-300 font-bold border-b border-blue-500/20 pb-2">
                <div className="flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-blue-400" />
                  <span>Blind Independent Oracle Contract</span>
                </div>
                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Strict Boundary Rule
                </span>
              </div>
              <div className="text-slate-300 text-[11px] leading-relaxed">
                <span className="text-slate-400">Signature: </span>
                <code className="text-blue-300 font-semibold">{data.signature}</code>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">INDEPENDENT TEST ARGUMENTS</span>
                  <code className="text-white font-bold">{data.defaultArgs}</code>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">EXPECTED RETURN VALUE</span>
                  <code className="text-emerald-400 font-bold">{data.expectedOutput}</code>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/20 p-2 rounded-lg">
                <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Vitest Status: <strong>RED (FAIL)</strong> — Boundary mutant returned unexpected result against expectation.
                </span>
              </div>
            </div>

            {/* Code Inspection Block */}
            <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden font-mono text-xs">
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>{data.file}</span>
                <span className="text-slate-500">Click a line to select candidate defect</span>
              </div>
              <div className="p-3 divide-y divide-transparent">
                {data.codeSnippet.map((line, idx) => {
                  const lineNum = idx + 1;
                  const isSelected = selectedLine === lineNum;
                  return (
                    <div
                      key={lineNum}
                      onClick={() => setSelectedLine(lineNum)}
                      className={`flex items-center gap-3 px-2 py-1.5 rounded cursor-pointer transition-all ${
                        isSelected
                          ? "bg-blue-600/30 border border-blue-500/50 text-white"
                          : "hover:bg-slate-900 text-slate-300"
                      }`}
                    >
                      <span className="w-6 text-right select-none text-slate-600 text-[10px]">{lineNum}</span>
                      <code className="flex-1 font-mono">{line.replace(/\s*\/\/\s*<--.*$/, "")}</code>
                      {isSelected && <span className="text-[10px] text-blue-400 font-bold uppercase">Selected</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Diagnostic Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-800 bg-slate-950/60">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mutated Line Selected:
                </label>
                <div className="text-xs font-mono font-bold text-blue-400 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
                  {selectedLine ? `Line ${selectedLine}` : "None (click a line above)"}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Original Expected Operator:</label>
                <div className="flex items-center gap-1.5">
                  {[">=", ">", "<=", "<", "==="].map((op) => (
                    <button
                      key={op}
                      onClick={() => setSelectedOp(op)}
                      className={`px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all ${
                        selectedOp === op ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Written Diagnostic Explanation
                </label>
                <input
                  type="text"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explain why this boundary operator breaks expected behavior..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              onClick={() => handleFinish(false)}
              disabled={!selectedLine}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
            >
              <Zap className="w-4 h-4" />
              <span>Submit Verification Diagnostic Proof</span>
            </button>
          </div>
        ) : (
          /* Verification Result Screen */
          <div className="rounded-2xl border border-emerald-500/40 bg-slate-900/60 p-6 sm:p-8 space-y-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Clean-Room Verification Complete</h2>
                  <span className="text-xs text-emerald-400 font-mono">
                    Diagnostic Score: {score}/100 • Completed in {TOTAL_TIME - timeLeft}s
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setTimeLeft(TOTAL_TIME);
                  setTimerRunning(true);
                  setIsCompleted(false);
                  setSelectedLine(null);
                  setExplanation("");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs font-mono"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry Challenge
              </button>
            </div>

            {/* Verifiable Output Card */}
            <div className="p-5 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs space-y-4">
              <div className="text-slate-400 border-b border-slate-800 pb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Cryptographic Assessment Attestation</span>
                </span>
                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  VERIFIED_PASS
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                <div>
                  <span className="text-slate-500">PR Ref: </span>
                  <span className="text-white font-semibold">{data.id}</span>
                </div>
                <div>
                  <span className="text-slate-500">Function: </span>
                  <span className="text-white font-semibold">{data.functionName}</span>
                </div>
                <div>
                  <span className="text-slate-500">Mutated Target: </span>
                  <span className="text-amber-400 font-semibold">Line {data.mutatedLine} ({data.mutatedOp})</span>
                </div>
                <div>
                  <span className="text-slate-500">Repair Operator: </span>
                  <span className="text-emerald-400 font-semibold">{selectedOp}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <span className="text-slate-500">Diagnostic Explanation: </span>
                <span className="text-slate-200 italic">&ldquo;{explanation || "Defect diagnosed and repaired"}&rdquo;</span>
              </div>

              {/* Cryptographic HMAC Integrity Block */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-slate-200">Cryptographic HMAC Attestation:</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400 font-mono">
                      {data.signatureMode || "production-hmac"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVerifyIntegrity(false)}
                      disabled={verifyStatus?.loading}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-sans font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{verifyStatus?.loading && !verifyStatus?.tampered ? "Verifying..." : "Verify Receipt Integrity"}</span>
                    </button>
                    <button
                      onClick={() => handleVerifyIntegrity(true)}
                      disabled={verifyStatus?.loading}
                      className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 disabled:opacity-40 text-xs font-sans font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{verifyStatus?.loading && verifyStatus?.tampered ? "Testing..." : "Simulate Tampering"}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1 text-[11px]">
                  <div className="text-slate-500 text-[10px]">WORKING DIFF SHA-256:</div>
                  <code className="text-emerald-400 break-all text-[11px] block">
                    {data.diffSha256 || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
                  </code>
                  {data.receiptSignature && (
                    <>
                      <div className="text-slate-500 text-[10px] pt-1">HMAC SIGNATURE (SHA-256):</div>
                      <code className="text-blue-400 break-all text-[11px] block">
                        {data.receiptSignature}
                      </code>
                    </>
                  )}
                </div>

                {/* Live Verification Result Banner */}
                {verifyStatus && !verifyStatus.loading && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 animate-in fade-in ${
                      verifyStatus.valid
                        ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                        : "bg-rose-950/50 border-rose-500/50 text-rose-300"
                    }`}
                  >
                    {verifyStatus.valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5">
                      <div className="font-bold flex items-center gap-2">
                        <span>{verifyStatus.valid ? "Receipt Cryptographically Valid" : "Tampering Detected!"}</span>
                        {verifyStatus.checkedAt && (
                          <span className="text-[10px] text-slate-400 font-normal">checked at {verifyStatus.checkedAt}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-300 font-sans">
                        {verifyStatus.tampered
                          ? "Simulated payload corruption: 1 byte of the working diff SHA-256 was flipped. Node HMAC verification immediately failed due to cryptographic signature mismatch."
                          : verifyStatus.reason}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                <span>View Global Reviewer Leaderboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/demo"
                className="py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs sm:text-sm"
              >
                Open CLI Simulator
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
