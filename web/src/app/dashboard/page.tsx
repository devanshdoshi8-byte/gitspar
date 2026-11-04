"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Shield,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  FileCheck,
  ExternalLink,
  X,
  Copy,
  Check,
  Cpu,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Bug,
  Award,
} from "lucide-react";

export interface SubmissionRecord {
  id: string;
  contributor: string;
  avatarUrl?: string;
  repo: string;
  prNumber: number;
  assessedFunction: string;
  filePath: string;
  mode: "mutation_drill" | "real_defect" | "unverified";
  modeLabel: "Mode A: Mutation Drill" | "Mode B: Real Defect" | "Flagged / Unverified";
  score: number;
  elapsedSeconds: number;
  baseCommitSha: string;
  workingDiffSha256: string;
  mutatedOperator: string;
  restoredOperator: string;
  diagnosticExplanation: string;
  verifiedAt: string;
}

const SEED_SUBMISSIONS: SubmissionRecord[] = [
  {
    id: "GS-8901",
    contributor: "alex-chen",
    repo: "devanshdoshi8-byte/gitspar",
    prNumber: 42,
    assessedFunction: "calculateTierDiscount",
    filePath: "examples/checkoutDiscount.ts",
    mode: "mutation_drill",
    modeLabel: "Mode A: Mutation Drill",
    score: 100,
    elapsedSeconds: 24,
    baseCommitSha: "9b3c4f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d",
    workingDiffSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    mutatedOperator: ">",
    restoredOperator: ">=",
    diagnosticExplanation: "Mutated >= to > so orderTotal 100 did not qualify for the 10% volume discount bracket.",
    verifiedAt: "2 mins ago",
  },
  {
    id: "GS-8902",
    contributor: "sarah-m",
    repo: "fintech-core/settlement-engine",
    prNumber: 128,
    assessedFunction: "verifySessionExpiry",
    filePath: "src/auth/session.ts",
    mode: "real_defect",
    modeLabel: "Mode B: Real Defect",
    score: 95,
    elapsedSeconds: 38,
    baseCommitSha: "4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b",
    workingDiffSha256: "7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e",
    mutatedOperator: "<",
    restoredOperator: "<=",
    diagnosticExplanation: "Caught AI off-by-one boundary defect where tokens expiring in the exact millisecond passed validity.",
    verifiedAt: "14 mins ago",
  },
  {
    id: "GS-8903",
    contributor: "david-k",
    repo: "cloud-mesh/rate-limiter",
    prNumber: 85,
    assessedFunction: "checkRateLimit",
    filePath: "src/limiter/window.ts",
    mode: "mutation_drill",
    modeLabel: "Mode A: Mutation Drill",
    score: 98,
    elapsedSeconds: 19,
    baseCommitSha: "1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
    workingDiffSha256: "8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
    mutatedOperator: "<",
    restoredOperator: "<=",
    diagnosticExplanation: "Operator flip caused request index 100 to be rejected even though ceiling is inclusive 100.",
    verifiedAt: "25 mins ago",
  },
  {
    id: "GS-8904",
    contributor: "priya-sharma",
    repo: "health-ai/patient-triage",
    prNumber: 310,
    assessedFunction: "evaluateVitalsRisk",
    filePath: "src/triage/riskScore.ts",
    mode: "real_defect",
    modeLabel: "Mode B: Real Defect",
    score: 100,
    elapsedSeconds: 32,
    baseCommitSha: "2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d",
    workingDiffSha256: "9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
    mutatedOperator: ">",
    restoredOperator: ">=",
    diagnosticExplanation: "Fixed inverted systolic blood pressure boundary where hypertensive urgency threshold was skipped.",
    verifiedAt: "42 mins ago",
  },
  {
    id: "GS-8905",
    contributor: "elena-rostova",
    repo: "ecommerce-hub/inventory-service",
    prNumber: 204,
    assessedFunction: "allocateWarehouseStock",
    filePath: "src/stock/allocation.ts",
    mode: "mutation_drill",
    modeLabel: "Mode A: Mutation Drill",
    score: 92,
    elapsedSeconds: 27,
    baseCommitSha: "3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e",
    workingDiffSha256: "1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
    mutatedOperator: ">",
    restoredOperator: ">=",
    diagnosticExplanation: "Identified that exactly matching stock items to order quantity failed when operator was strictly greater.",
    verifiedAt: "1 hour ago",
  },
  {
    id: "GS-8906",
    contributor: "marcus-vibe",
    repo: "dev-starter/social-feed",
    prNumber: 15,
    assessedFunction: "renderCommentThread",
    filePath: "src/feed/threads.ts",
    mode: "unverified",
    modeLabel: "Flagged / Unverified",
    score: 40,
    elapsedSeconds: 60,
    baseCommitSha: "5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a",
    workingDiffSha256: "4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d",
    mutatedOperator: "!==",
    restoredOperator: "===",
    diagnosticExplanation: "Timeout occurred during diagnostic drill; developer failed to isolate boundary failure.",
    verifiedAt: "2 hours ago",
  },
  {
    id: "GS-8907",
    contributor: "jordan-lee",
    repo: "auth-guard/rbac-service",
    prNumber: 94,
    assessedFunction: "checkRolePermission",
    filePath: "src/rbac/authorization.ts",
    mode: "mutation_drill",
    modeLabel: "Mode A: Mutation Drill",
    score: 96,
    elapsedSeconds: 21,
    baseCommitSha: "6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b",
    workingDiffSha256: "5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e",
    mutatedOperator: "<",
    restoredOperator: "<=",
    diagnosticExplanation: "Admin role level 10 was denied access because operator checked strictly less instead of less-or-equal.",
    verifiedAt: "3 hours ago",
  },
  {
    id: "GS-8908",
    contributor: "kenji-sato",
    repo: "crypto-vault/signer-engine",
    prNumber: 52,
    assessedFunction: "validateNonceSequence",
    filePath: "src/vault/nonce.ts",
    mode: "real_defect",
    modeLabel: "Mode B: Real Defect",
    score: 100,
    elapsedSeconds: 30,
    baseCommitSha: "7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c",
    workingDiffSha256: "6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f",
    mutatedOperator: ">=",
    restoredOperator: "===",
    diagnosticExplanation: "Caught AI hallucination allowing non-monotonic nonces across parallel signing threads.",
    verifiedAt: "4 hours ago",
  },
  {
    id: "GS-8909",
    contributor: "rachel-green",
    repo: "streaming-api/bandwidth-allocator",
    prNumber: 67,
    assessedFunction: "calculateBitrateProfile",
    filePath: "src/stream/bitrate.ts",
    mode: "mutation_drill",
    modeLabel: "Mode A: Mutation Drill",
    score: 94,
    elapsedSeconds: 23,
    baseCommitSha: "8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d",
    workingDiffSha256: "7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a",
    mutatedOperator: ">",
    restoredOperator: ">=",
    diagnosticExplanation: "Flipped comparison prevented 4K streams from being allocated on exact 25Mbps connections.",
    verifiedAt: "5 hours ago",
  },
  {
    id: "GS-8910",
    contributor: "unknown-coder",
    repo: "legacy-app/migration-script",
    prNumber: 12,
    assessedFunction: "batchMigrateRecords",
    filePath: "src/migrate/batch.ts",
    mode: "unverified",
    modeLabel: "Flagged / Unverified",
    score: 30,
    elapsedSeconds: 60,
    baseCommitSha: "9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e",
    workingDiffSha256: "8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
    mutatedOperator: "<",
    restoredOperator: "<=",
    diagnosticExplanation: "Receipt tampered: workingDiffSha256 does not match git diff.",
    verifiedAt: "6 hours ago",
  },
];

export default function DashboardPage() {
  const [filterTab, setFilterTab] = useState<"all" | "mutation_drill" | "real_defect" | "unverified">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<SubmissionRecord | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Filter submissions
  const filtered = SEED_SUBMISSIONS.filter((item) => {
    if (filterTab !== "all" && item.mode !== filterTab) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.contributor.toLowerCase().includes(q) ||
        item.repo.toLowerCase().includes(q) ||
        item.assessedFunction.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const copyHash = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Title & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono mb-2">
            <Activity className="w-3.5 h-3.5" />
            Reviewer &amp; Hackathon Organizer Portal
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Comprehension Leaderboard &amp; Audit Log
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time verification telemetry tracking developer comprehension drills and AI defect fixes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/demo"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-blue-600/20"
          >
            <Cpu className="w-4 h-4" />
            <span>Launch Drill Sandbox</span>
          </Link>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Assessed PRs / Teams</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white font-mono">1,482</div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mt-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+18.4% from last hackathon cohort</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Comprehension Pass Rate</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-white font-mono">92.4%</div>
          <div className="text-xs text-slate-400 mt-2">
            Killed 1,369 AST mutants on first drill
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Real Defects Caught (Mode B)</span>
            <Bug className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-white font-mono">147</div>
          <div className="text-xs text-amber-400 font-medium mt-2">
            Pre-deployment boundary regressions fixed
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Average Diagnosis Time</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-white font-mono">27.6s</div>
          <div className="text-xs text-slate-400 mt-2">
            Well within 60s clean-room timer
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto text-xs font-medium">
          {[
            { key: "all", label: "All Submissions" },
            { key: "mutation_drill", label: "Verified (Mode A)" },
            { key: "real_defect", label: "Real Defects Fixed (Mode B)" },
            { key: "unverified", label: "Flagged / Unverified" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key as any)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                filterTab === tab.key
                  ? "bg-blue-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contributor, repo, fn..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Submissions Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur shadow-2xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 font-semibold uppercase text-slate-400 tracking-wider">
              <th className="py-3.5 px-4">Contributor / Team</th>
              <th className="py-3.5 px-4">Repository</th>
              <th className="py-3.5 px-4">Assessed Function</th>
              <th className="py-3.5 px-4">Assessment Mode</th>
              <th className="py-3.5 px-4 text-center">Score</th>
              <th className="py-3.5 px-4 text-right">Elapsed Time</th>
              <th className="py-3.5 px-4 text-center">Verifiable Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
            {filtered.map((item) => {
              const isPassing = item.score >= 80;
              return (
                <tr
                  key={item.id}
                  onClick={() => setSelectedRecord(item)}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4 font-sans font-medium text-white flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] uppercase text-blue-400 font-bold">
                      {item.contributor.substring(0, 2)}
                    </div>
                    <span>@{item.contributor}</span>
                  </td>

                  <td className="py-3 px-4 text-slate-400 group-hover:text-slate-300">
                    {item.repo} <span className="text-slate-600">#{item.prNumber}</span>
                  </td>

                  <td className="py-3 px-4 text-blue-300 font-medium">
                    {item.assessedFunction}
                  </td>

                  <td className="py-3 px-4 font-sans">
                    {item.mode === "mutation_drill" && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-blue-400" />
                        Mode A: Mutation Drill
                      </span>
                    )}
                    {item.mode === "real_defect" && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                        <Bug className="w-3 h-3 text-emerald-400" />
                        Mode B: Real Defect
                      </span>
                    )}
                    {item.mode === "unverified" && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-semibold">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        Flagged / Unverified
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <span
                      className={`font-bold ${
                        isPassing ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {item.score}%
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right text-slate-400">
                    {item.elapsedSeconds}s
                  </td>

                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRecord(item);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-sans font-medium transition-colors"
                    >
                      <FileCheck className="w-3 h-3 text-blue-400" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-500 font-sans">
            No submissions matched your search or filter.
          </div>
        )}
      </div>

      {/* Receipt Inspector Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    GitSpar Cryptographic Receipt Inspector
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    ID: {selectedRecord.id} • {selectedRecord.verifiedAt}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 font-mono text-xs text-slate-300">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px]">CONTRIBUTOR</span>
                  <span className="text-white font-semibold">@{selectedRecord.contributor}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">REPOSITORY</span>
                  <span className="text-white font-semibold">
                    {selectedRecord.repo} #{selectedRecord.prNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">ASSESSED FUNCTION</span>
                  <span className="text-blue-400 font-semibold">{selectedRecord.assessedFunction}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">DIAGNOSTIC SCORE</span>
                  <span
                    className={`font-bold ${
                      selectedRecord.score >= 80 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {selectedRecord.score} / 100 ({selectedRecord.elapsedSeconds}s)
                  </span>
                </div>
              </div>

              {/* Mutation Details */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Mutated AST Operator:</span>
                  <span className="text-amber-400 font-bold">{selectedRecord.mutatedOperator}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Repaired Restored Operator:</span>
                  <span className="text-emerald-400 font-bold">{selectedRecord.restoredOperator}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 text-[11px]">
                  <span className="text-slate-500 block text-[10px] mb-1">
                    WRITTEN DIAGNOSTIC PROOF
                  </span>
                  <p className="text-slate-200 font-sans italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                    &ldquo;{selectedRecord.diagnosticExplanation}&rdquo;
                  </p>
                </div>
              </div>

              {/* Cryptographic Hashes */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-[10px]">
                <div>
                  <div className="text-slate-500 mb-0.5">BASE COMMIT SHA:</div>
                  <code className="text-slate-300 break-all">{selectedRecord.baseCommitSha}</code>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5 flex items-center justify-between">
                    <span>WORKING DIFF SHA-256 HASH:</span>
                    <button
                      onClick={() => copyHash(selectedRecord.workingDiffSha256)}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono"
                    >
                      {copiedHash ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedHash ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <code className="text-emerald-400 break-all">{selectedRecord.workingDiffSha256}</code>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href={`/verify/${selectedRecord.id}`}
                className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span>View Full Drill Session</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
