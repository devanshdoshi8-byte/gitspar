"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Shield,
  Terminal,
  Check,
  Copy,
  ExternalLink,
  Cpu,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  GitPullRequest,
  Fingerprint,
  Zap,
  Lock,
  Code2,
  Server,
  HelpCircle,
  FileCheck,
  Flame,
  Gauge,
  Workflow,
} from "lucide-react";

export default function LandingPage() {
  const [copied, setCopied] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const copyCommand = () => {
    navigator.clipboard.writeText("npx gitspar");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-24 py-12 md:py-20">
      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center flex flex-col items-center">
        {/* Glow background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-600/20 via-blue-500/10 to-emerald-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-semibold mb-6 shadow-sm">
          <Shield className="w-4 h-4 text-blue-400 animate-pulse" />
          <span>Editor-Agnostic Diagnostic Gatekeeper</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.1]">
          Verified Change Understanding for{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400">
            AI-Assisted Code
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed">
          An editor-agnostic diagnostic gatekeeper that transforms AI-generated code changes into executable
          comprehension drills.
        </p>

        {/* Copyable Terminal Card */}
        <div className="mt-8 w-full max-w-lg">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-xl shadow-2xl backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-mono text-sm select-none">$</span>
              <code className="text-slate-100 font-mono text-sm font-medium">npx gitspar</code>
            </div>
            <button
              onClick={copyCommand}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all font-mono"
              aria-label="Copy command"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/demo"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] text-sm"
          >
            <Cpu className="w-4 h-4" />
            <span>Try Live Simulator</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
          <a
            href="https://github.com/devanshdoshi8-byte/gitspar"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-semibold transition-all hover:border-slate-600 text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            <span>View on GitHub</span>
          </a>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-slate-300 font-semibold transition-all text-sm"
          >
            <Gauge className="w-4 h-4 text-emerald-400" />
            <span>Reviewer Dashboard</span>
          </Link>
        </div>
      </section>

      {/* The Problem vs Solution Visual */}
      <section id="problem" className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Why Passing Tests Aren&apos;t Enough
          </h2>
          <p className="mt-3 text-slate-400 text-base max-w-2xl mx-auto">
            AI makes generating code fast. GitSpar ensures you understand boundary conditions, edge cases, and failure modes before you commit.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Problem Card */}
          <div className="relative rounded-2xl border border-red-500/20 bg-slate-900/50 p-6 sm:p-8 backdrop-blur overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Vibe-Coding Cognitive Debt</h3>
                <span className="text-xs text-red-400 font-mono">The Comprehension Gap</span>
              </div>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              Developers hit Tab or &ldquo;Accept All&rdquo; on AI diffs without forming a mental execution model. When
              boundary cases fail in production, debugging takes 10x longer because nobody knows how the logic works.
            </p>

            <ul className="space-y-3.5 text-sm text-slate-400">
              <li className="flex items-start gap-2.5">
                <span className="text-red-400 font-bold mt-0.5">✕</span>
                <span>
                  <strong>Hallucinated edge cases:</strong> Subtle off-by-one errors and unchecked boundary conditions.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-400 font-bold mt-0.5">✕</span>
                <span>
                  <strong>Conversational chat bypass:</strong> Users ask AI to explain the AI code, compounding false
                  assumptions.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-400 font-bold mt-0.5">✕</span>
                <span>
                  <strong>Faux code reviews:</strong> Reviewers glaze over 800-line PRs and approve with &ldquo;LGTM&rdquo;.
                </span>
              </li>
            </ul>
          </div>

          {/* Solution Card */}
          <div className="relative rounded-2xl border border-emerald-500/30 bg-slate-900/50 p-6 sm:p-8 backdrop-blur overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Executable Mutation Testing</h3>
                <span className="text-xs text-emerald-400 font-mono">Proof of Comprehension</span>
              </div>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              GitSpar creates an independent oracle probe from function signatures and injects live AST mutations into
              your code. You must independently diagnose and repair the defect against Vitest before shipping.
            </p>

            <ul className="space-y-3.5 text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  <strong>Blind Independent Oracle:</strong> Prompts you for input/output without showing implementation body.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  <strong>AST Boundary Mutation:</strong> Flips comparison operators (`&gt;=`, `&lt;=`, `===`) to verify you detect edge behavior.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  <strong>Cryptographic PR Receipt:</strong> Binds base commit SHA and working diff SHA-256 into `.gitspar/receipt.json`.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4-Step Interactive Loop Visualizer */}
      <section id="how-it-works" className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Workflow className="w-3.5 h-3.5" />
            Diagnostic Loop
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            How GitSpar Enforces True Understanding
          </h2>
          <p className="mt-3 text-slate-400 text-base max-w-2xl mx-auto">
            Zero cloud backend required. Runs completely locally inside your repository using your existing Vitest test
            runner.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-slate-700 transition-all hover:-translate-y-1">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/20">
                  STEP 01
                </span>
                <Fingerprint className="w-5 h-5 text-blue-400" />
              </div>
              <h4 className="text-base font-bold text-white mb-2">Working-Tree Fingerprinting</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Computes a SHA-256 fingerprint over your uncommitted git diff and records the base commit SHA. Ensures
                drills cannot be solved for stale code.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800/80 font-mono text-[11px] text-blue-300">
              sha256(git diff origin/master)
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-slate-700 transition-all hover:-translate-y-1">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-400 border border-indigo-500/20">
                  STEP 02
                </span>
                <Code2 className="w-5 h-5 text-indigo-400" />
              </div>
              <h4 className="text-base font-bold text-white mb-2">Blind Independent Oracle</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Presents you with solely the function signature (e.g. `calculateDiscount(total, isStudent)`). You specify
                boundary inputs and expected output blind to the body.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800/80 font-mono text-[11px] text-indigo-300">
              oracle([100, false]) =&gt; 90
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-slate-700 transition-all hover:-translate-y-1">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-600/20 text-amber-400 border border-amber-500/20">
                  STEP 03
                </span>
                <Flame className="w-5 h-5 text-amber-400" />
              </div>
              <h4 className="text-base font-bold text-white mb-2">AST Mutation Drill</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                ts-morph parses the AST, flips a critical boundary comparison (`&gt;=` to `&gt;`), runs Vitest (must fail
                RED), and tests your diagnosis on line repair.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800/80 font-mono text-[11px] text-amber-300">
              vitest run temp_mutant.ts ✖ FAIL
            </div>
          </div>

          {/* Step 4 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-slate-700 transition-all hover:-translate-y-1">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/20">
                  STEP 04
                </span>
                <FileCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <h4 className="text-base font-bold text-white mb-2">Verifiable PR Receipt</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generates a cryptographically bound `.gitspar/receipt.json` and Markdown table for your PR. CI enforces
                instant check pass or rejection.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800/80 font-mono text-[11px] text-emerald-300">
              PR_RECEIPT.md &amp; exit 0 in CI
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section id="differentiation" className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            How GitSpar Compares
          </h2>
          <p className="mt-3 text-slate-400 text-base max-w-2xl mx-auto">
            Why executable mutation testing renders conversational quizzes and sandbox benchmarks obsolete.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur shadow-2xl">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-xs font-semibold uppercase text-slate-300">
                <th className="py-4 px-6">Evaluation Dimension</th>
                <th className="py-4 px-6 text-blue-400 bg-blue-950/30 border-x border-blue-900/40">
                  GitSpar (Executable)
                </th>
                <th className="py-4 px-6 text-slate-400">Conversational Quiz (PR Guard / Own Your Diff)</th>
                <th className="py-4 px-6 text-slate-400">Benchmark Sandbox (PraxisAI / Codritium)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-normal text-slate-300">
              <tr className="hover:bg-slate-800/20 transition-colors">
                <td className="py-4 px-6 font-semibold text-white">Comprehension Verification Mechanism</td>
                <td className="py-4 px-6 text-emerald-400 bg-blue-950/20 border-x border-blue-900/30 font-medium">
                  Executable AST mutation + Vitest runner
                </td>
                <td className="py-4 px-6 text-slate-400">LLM conversational multiple-choice quiz</td>
                <td className="py-4 px-6 text-slate-400">Pre-canned static benchmark problems</td>
              </tr>
              <tr className="hover:bg-slate-800/20 transition-colors">
                <td className="py-4 px-6 font-semibold text-white">Resistance to AI Cheating</td>
                <td className="py-4 px-6 text-emerald-400 bg-blue-950/20 border-x border-blue-900/30 font-medium">
                  High (Blind oracle + dynamic operator mutation)
                </td>
                <td className="py-4 px-6 text-red-400">Zero (User pastes quiz back into ChatGPT)</td>
                <td className="py-4 px-6 text-amber-400">Moderate (Dataset contamination risk)</td>
              </tr>
              <tr className="hover:bg-slate-800/20 transition-colors">
                <td className="py-4 px-6 font-semibold text-white">Cloud Dependency &amp; Setup Cost</td>
                <td className="py-4 px-6 text-emerald-400 bg-blue-950/20 border-x border-blue-900/30 font-medium">
                  Zero cloud setup (`npx gitspar` in local repo)
                </td>
                <td className="py-4 px-6 text-slate-400">Requires SaaS server &amp; OpenAI API keys</td>
                <td className="py-4 px-6 text-slate-400">Requires dedicated cloud VM sandboxes</td>
              </tr>
              <tr className="hover:bg-slate-800/20 transition-colors">
                <td className="py-4 px-6 font-semibold text-white">Cryptographic PR Gatekeeping</td>
                <td className="py-4 px-6 text-emerald-400 bg-blue-950/20 border-x border-blue-900/30 font-medium">
                  SHA-256 diff binding to base commit
                </td>
                <td className="py-4 px-6 text-red-400">None (Informational PR comment only)</td>
                <td className="py-4 px-6 text-slate-400">External dashboard link</td>
              </tr>
              <tr className="hover:bg-slate-800/20 transition-colors">
                <td className="py-4 px-6 font-semibold text-white">Feedback Loop Latency</td>
                <td className="py-4 px-6 text-emerald-400 bg-blue-950/20 border-x border-blue-900/30 font-medium">
                  &lt; 5 seconds locally
                </td>
                <td className="py-4 px-6 text-slate-400">15-30s LLM roundtrip</td>
                <td className="py-4 px-6 text-slate-400">1-3 minutes VM boot</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Architecture & FAQ Section */}
      <section id="faq" className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            System Architecture &amp; Insights
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Frequently Asked Technical Questions
          </h2>
        </div>

        <div className="space-y-4">
          {[
            {
              q: "How does GitSpar work alongside AI editors like Cursor, Copilot, and Antigravity?",
              a: "AI editors like Cursor, GitHub Copilot, and Antigravity are creation tools designed for high-velocity code generation inside the IDE. GitSpar serves as an editor-agnostic verification gatekeeper that runs locally before push (or in CI). Just as Git and Vitest complement IDE code writing, GitSpar ensures that code generated with AI assistance is fully understood, diagnosed, and tested before merging.",
            },
            {
              q: "Why are executable AST mutations superior to conversational quizzes?",
              a: "Text-based quizzes can be copied and solved by an LLM in 2 seconds without the developer learning anything. Executable mutations require understanding actual runtime behavior: an isolated Vitest test suite executes your blind input expectations, introduces a precise AST boundary flip, and validates that you can locate and repair the failing branch.",
            },
            {
              q: "How does GitSpar ensure the developer didn't modify code after verifying?",
              a: "GitSpar computes a cryptographic SHA-256 hash of the exact git diff between your working tree and the merge base commit (`git merge-base origin/master HEAD`). This hash is embedded into `.gitspar/receipt.json`. If a single character is altered after verification, CI recalculates the diff hash and fails immediately.",
            },
            {
              q: "Does GitSpar send our proprietary source code to any third-party cloud?",
              a: "No. GitSpar is 100% local and open-source. AST analysis is performed using ts-morph, and test execution runs on your local Vitest instance. There are zero external API calls, zero telemetry tracking, and zero data leakage.",
            },
          ].map((item, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden transition-all"
            >
              <button
                onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between text-base font-semibold text-white hover:text-blue-300 transition-colors"
              >
                <span>{item.q}</span>
                <span className="text-slate-400 font-mono text-lg">{activeFaq === index ? "−" : "+"}</span>
              </button>
              {activeFaq === index && (
                <div className="px-6 pb-5 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-900/30 via-slate-900 to-blue-950/40 p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to Verify Your AI-Assisted Code?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto mb-8">
            Experience the clean-room mutation simulator right in your browser, or run the zero-install CLI in your
            repository today.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/demo"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30 transition-all text-sm"
            >
              <Cpu className="w-4 h-4" />
              <span>Launch Live Simulator</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-semibold transition-all text-sm"
            >
              <Gauge className="w-4 h-4 text-emerald-400" />
              <span>Reviewer Leaderboard</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
