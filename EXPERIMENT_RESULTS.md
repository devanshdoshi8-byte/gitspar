# GitSpar Empirical Research Benchmark Report: Diagnostic Mutation Verification

**Publication Date:** November 2026  
**Research Lead:** GitSpar Core Research Group  
**Target Repository:** `devanshdoshi8-byte/gitspar`  
**Engine Version:** v0.3.0  
**Methodology:** Clean-Room Behavioral Oracle + AST Boundary Mutation Testing (ts-morph / Vitest)

---

## 1. Executive Summary

As AI code generators (GitHub Copilot, Cursor, Claude 3.7 Sonnet) approach ubiquitous adoption, software teams face a crisis of **"cognitive debt"**: developers commit hundreds of lines of syntactically valid code without understanding subtle boundary conditions. Traditional gatekeeping mechanisms rely on static linters or conversational LLM quizzes—both of which can be gamed without genuine comprehension.

This benchmark evaluates **GitSpar**, an editor-agnostic diagnostic gatekeeper that introduces **executable mutation drills** and **cryptographic diff verification**. Across **10 autonomous empirical runs** spanning two distinct cohorts:
- **Cohort A (Diagnostic Comprehension Drills):** Achieved **100% mutant kill rate** across all 5 production modules, validating that boundary inversions (e.g., `>=` to `>`) are deterministically caught by blind independent oracles.
- **Cohort B (CI Gatekeeper Validations):** Achieved **100% enforcement fidelity**, accurately accepting valid cryptographic PR receipts (exit code 0) while cleanly intercepting tampered diff hashes, missing receipts, and unfinished repairs (exit code 1) with **0% false positives or false negatives**.

---

## 2. Benchmark Architecture & Methodology

The benchmark suite evaluates two complementary cohorts:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   GITSPAR EMPIRICAL BENCHMARK PIPELINE                  │
├───────────────────────────────────┬────────────────────────────────────┤
│   COHORT A: Diagnostic Drills     │    COHORT B: CI PR Gatekeeping     │
│   (5 Production-Shaped Modules)   │    (5 Deterministic CI Scenarios)  │
├───────────────────────────────────┼────────────────────────────────────┤
│ 1. Session Token Expiry           │ 1. Valid Mode A Drill Receipt      │
│ 2. Sliding Rate Limiter           │ 2. Missing Receipt Enforcer        │
│ 3. Tiered Volume Pricing          │ 3. Tampered Diff SHA-256 Reject    │
│ 4. Warehouse Stock Allocation     │ 4. Abandoned Drill Reject          │
│ 5. Role-Based Permissions (RBAC)  │ 5. Valid Mode B Real Defect Fix    │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Evaluation Metrics:
1. **Baseline Oracle Pass Rate (%):** Proportion of unmodified modules that validate against user-specified inputs.
2. **Mutant Kill Rate (%):** Proportion of boundary-mutated AST copies that cause Vitest to fail RED.
3. **Repair Accuracy (%):** Proportion of repaired functions that restore test passing status to GREEN.
4. **CI Enforcement Fidelity (%):** Accuracy of GitHub Actions gatekeeper exit codes against tampered or valid PR diffs.
5. **Execution Latency (ms):** Total wall-clock time per diagnostic cycle.

---

## 3. Empirical Results

### Cohort A: Developer Diagnostic Drills (AST Mutation & Oracle Probing)

| Run ID | Production Module | Target Function | Baseline | Mutant Kill | Repair Test | Latency | Diagnostic Explanation |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `M1` | `authSession.ts` | `isSessionExpired` | ✅ PASS | ✅ KILLED | ✅ RESTORED | 14510ms | "Boundary comparison mutated >= to > causing exact-millisecond expired token to be reported active." |
| `M2` | `rateLimiter.ts` | `isRateLimitAllowed` | ✅ PASS | ✅ KILLED | ✅ RESTORED | 14207ms | "Request count matching inclusive rate limit threshold was rejected when <= was mutated to <." |
| `M3` | `tieredPricing.ts` | `calculateVolumeDiscount` | ✅ PASS | ✅ KILLED | ✅ RESTORED | 12354ms | "Order quantity at exact tier threshold 50 triggered volume discount prematurely when > mutated to >=." |
| `M4` | `inventoryAllocation.ts` | `canAllocateStock` | ✅ PASS | ✅ KILLED | ✅ RESTORED | 13896ms | "Allocation request with exact matching warehouse stock was declined when >= was mutated to >." |
| `M5` | `rolePermissions.ts` | `hasPermissionLevel` | ✅ PASS | ✅ KILLED | ✅ RESTORED | 12669ms | "User with exact role level required was denied access when >= was mutated to >." |

### Cohort B: CI Gatekeeper Validations (Cryptographic PR Receipts)

| Run ID | Scenario Tested | Security Objective | Expected Exit | Actual Exit | Fidelity Status | Latency |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `CI-1` | Valid Mode A Receipt | Receipt with exact diff SHA-256 and repair_test='passed' | `0` | `0` | ✅ MATCH | 5340ms |
| `CI-2` | Missing Receipt | No .gitspar/receipt.json present in repo | `1` | `1` | ✅ MATCH | 228ms |
| `CI-3` | Tampered Diff SHA | Receipt diff SHA does not match current git working diff | `1` | `1` | ✅ MATCH | 3579ms |
| `CI-4` | Incomplete / Abandoned Drill | Receipt where repair_test is not 'passed' | `1` | `1` | ✅ MATCH | 240ms |
| `CI-5` | Valid Mode B (Real Defect) Receipt | Legitimate developer caught genuine defect prior to PR | `0` | `0` | ✅ MATCH | 3587ms |

---

## 4. Aggregate Benchmark Statistics

| Metric | Measured Benchmark Value | Target Specification | Status |
| :--- | :---: | :---: | :---: |
| **Cohort A Baseline Oracle Pass Rate** | **100.0%** | 100.0% | 🎯 Met |
| **Cohort A AST Mutant Kill Rate** | **100.0%** | 100.0% | 🎯 Met |
| **Cohort A Repair Restoration Accuracy** | **100.0%** | 100.0% | 🎯 Met |
| **Cohort B CI Gatekeeper Enforcement** | **100.0%** | 100.0% | 🎯 Met |
| **False Positive Rejection Rate** | **0.0%** | < 1.0% | 🎯 Met |
| **False Negative Acceptance Rate** | **0.0%** | 0.0% | 🎯 Met |
| **Mean Drill Execution Latency** | **13527 ms** | < 15,000 ms | ⚡ Fast (3x Vitest runs) |
| **Mean CI Gatekeeper Latency** | **2595 ms** | < 5,000 ms | ⚡ Sub-second to 2s |

---

## 5. Academic & Industrial Discussion

### Finding 1: The Inefficacy of Conversational Code Review
Conversational quiz tools allow a developer to paste quiz prompts back into their IDE LLM. Because GitSpar executes blind boundary oracles and dynamically alters AST nodes locally without cloud roundtrips, the developer is forced to execute code mentally.

### Finding 2: Cryptographic Tamper Resistance
Binding `working_diff_sha256` to `base_commit_sha` prevents the "bait-and-switch" vulnerability where a developer verifies a single harmless utility and then bundles 500 lines of unverified AI code into the same PR.

### Finding 3: Zero-Cloud Portability
By relying strictly on TypeScript AST manipulation (`ts-morph`) and local test execution (`vitest`), GitSpar eliminates cloud sandboxing latency and third-party SaaS hosting costs.

---

## 6. How to Reproduce

Run the autonomous benchmark suite directly in any environment with Node.js 20+:

```bash
npm run experiment
```
