# DiffProof (v0.1) — Architecture Specification & Engineering Rules

## 1. Product Vision & The Core Problem We Solve
In 2026, AI coding agents (Antigravity, Cursor, Claude Code, Codex, Windsurf) allow developers, students, and open-source contributors to generate hundreds of lines of working code in minutes ("vibe coding").
However, this created a massive second-order crisis:
1. **Cognitive Debt:** Builders accept large AI-generated diffs without understanding the underlying control flow, boundary conditions, or failure modes.
2. **The Reviewer Trust Gap:** Hackathon judges, university CS instructors, coding bootcamps, and open-source maintainers are overwhelmed by AI-generated submissions and pull requests where the human author cannot explain or debug the code they submitted.

**What DiffProof Is:**
DiffProof is a local, editor-agnostic engineering assessment CLI (`npx diffproof`) and GitHub Pull Request verification system. Instead of testing developers on random pre-made interview puzzles (like PraxisAI, Codritium, or Recticode) or only verifying software behavior against YAML contracts without checking human comprehension (like MaruCheck), DiffProof uses the developer's **own recent working-tree Git changes** to create a controlled, executable **Verified Change Understanding** assessment.

DiffProof does NOT claim to prove 100% codebase ownership, does NOT claim to detect every security vulnerability, and does NOT pretend to block external AI windows locally. It records verifiable evidence of what specific code change the developer diagnosed, repaired, and explained against an independent behavioral test.

---

## 2. Five Non-Negotiable Engineering & Scientific Rules

### RULE 1: Solve the Test Oracle Problem (Never Trust Implementation-Derived Tests)
If an AI writes `function calculateDiscount(price) { return price * 0.8 }` when the business requirement was a 10% discount (`0.9`), an automated tool that inspects the code and generates `expect(calculateDiscount(100)).toBe(80)` merely validates the bug against itself.
- **Architectural Requirement:** DiffProof MUST establish an **Independent Behavioral Oracle** BEFORE running the implementation:
  1. Either use an existing, independently written test file, OR
  2. Run a **Blind Human Oracle Prompt**: Show the developer ONLY the exported function's name, parameter names/types, and return type (hiding the implementation body) and require the developer to specify the expected return value for a boundary input (e.g., input `[100, false]` -> expected output `90`).

### RULE 2: Strict Separation of Mode A (`mutation_drill`) vs. Mode B (`real_defect`)
Once the developer specifies the independent oracle assertion, DiffProof runs Vitest against the **unmodified function**:
- **MODE B (`real_defect` — Genuine Defect Discovery):**
  If the unmodified function FAILS the developer's stated oracle expectation (`RED`), there is already a real mismatch between the developer's mental model/requirement and the code in their working tree. Do NOT inject an artificial bug. Route the developer into `real_defect` mode: show the failing test output and line-numbered function, have them fix their actual code until the oracle passes (`GREEN`), and record their explanation of the real defect.
- **MODE A (`mutation_drill` — Controlled Fault Diagnosis):**
  If the unmodified function PASSES the developer's stated oracle expectation (`GREEN`), create a disposable copy of the file in `.diffproof/temp/` and apply **one deterministic AST boundary mutation** (flipping `<`, `<=`, `>`, `>=`, `===`, `!==`) so that the developer's boundary test now FAILS (`RED` — killing the mutant). Ask the developer to:
  1. Pinpoint the exact line number where the boundary condition is broken.
  2. Identify the correct operator/condition to restore `GREEN`.
  3. Write a concise root-cause explanation of why that boundary mutation caused their test input to fail.
*Never mix Mode A and Mode B scores or receipts—they prove different things.*

### RULE 3: Source Isolation vs. Runtime Isolation (Strict v0.1 Function Filtering)
Git worktrees or temporary file copies only isolate tracked source files—they do NOT isolate `.env` secrets, `node_modules`, databases, or network ports, and importing arbitrary files can trigger top-level side effects.
- **Architectural Requirement for v0.1:**
  - Use `ts-morph` to statically inspect changed TypeScript files and list **only exported, self-contained, deterministic functions** (functions taking primitive/plain-object parameters that contain at least one relational/equality operator and do NOT call `fetch`, `process.env`, file I/O, or database clients).
  - Explicitly mark impure route handlers or database-dependent functions as unsupported in v0.1 rather than pretending to mock them automatically.
  - Always require **manual function selection** and **explicit user approval** in the CLI before executing any code in Vitest.

### RULE 4: Accurate Git Working-Tree Fingerprinting
A `git diff` cannot distinguish which lines were typed by an AI vs. a human, and uncommitted working-tree edits do not have their own commit SHA yet.
- **Architectural Requirement:**
  - Discover both tracked working-tree modifications (`git diff HEAD --name-only`) and untracked `.ts` files (`git ls-files --others --exclude-standard`).
  - Every receipt must record both `base_commit_sha` (`git rev-parse HEAD`) AND `working_diff_sha256` (a SHA-256 hash of `git diff HEAD` plus the contents of any untracked target files) so the exact assessed state is cryptographically fingerprinted.

### RULE 5: Zero-Conflict Local Stack & Two-Phase Product Roadmap
- **Phase 1 (Our 2-Week MVP — Local CLI Engine):**
  - Built in TypeScript (`NodeNext` ESM) using `tsx`, `ts-morph` (for AST inspection and boundary mutation), `vitest` (for isolated test execution), and Node's built-in `node:readline/promises` + ANSI escape codes (avoiding `inquirer` or `chalk` ESM/CommonJS conflicts).
  - Outputs `.diffproof/receipt.json` and a human-readable `.diffproof/PR_RECEIPT.md` table for GitHub Pull Requests, hackathon submissions, and CS coursework.
- **Phase 2 (Next Milestone — "Cursor-Proof" Clean-Room GitHub PR Gatekeeper):**
  - A GitHub Action + lightweight web check that reads the PR diff and challenges the contributor in a clean browser view outside their IDE (so an IDE sidebar agent cannot autocomplete the diagnosis for them), posting a verified status check on the Pull Request.

---

## 3. Planned Repository Structure for Phase 1 (v0.1 CLI)

```
diffproof/
├── ARCHITECTURE.md           # This master specification
├── package.json              # ts-morph, vitest, tsx, typescript
├── tsconfig.json             # NodeNext ESM configuration
├── src/
│   ├── git.ts                # Discovers tracked/untracked changes & computes base_commit_sha + working_diff_sha256
│   ├── ast.ts                # Uses ts-morph to filter pure exported functions, extract blind signatures, and apply boundary mutations
│   ├── runner.ts             # Generates temporary Vitest spec for the user's independent oracle and executes Vitest
│   ├── receipt.ts            # Writes .diffproof/receipt.json and .diffproof/PR_RECEIPT.md
│   └── cli.ts                # Interactive terminal workflow orchestrating Blind Oracle -> Mode A / Mode B -> Receipt
└── examples/
    └── checkoutDiscount.ts   # Realistic e-commerce discount function for end-to-end testing
```
