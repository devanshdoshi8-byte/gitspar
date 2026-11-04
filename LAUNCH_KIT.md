# GitSpar (`v0.3.0`) — Launch & Distribution Kit 🚀

> *"Replacing prompt theater with executable mutation testing for AI-assisted code."*

---

## ⚡ 1. Instant Installation & Local Execution

Developers can run GitSpar immediately in any repository containing TypeScript changes without manual setup:

```bash
# Run assessment against current working-tree changes:
npx gitspar

# Or target a specific module directly:
npx gitspar examples/checkoutDiscount.ts

# Inspect your latest verification receipt:
npm run receipt
```

---

## 🤖 2. 5-Line GitHub Action Integration (Maintainers & Hackathons)

Drop this gatekeeper into any repository (`.github/workflows/gitspar-gate.yml`) to block unverified AI PRs:

```yaml
name: GitSpar Verification Gatekeeper
on: [pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci && npx gitspar --ci
```

---

## 📣 3. High-Impact Social Launch Posts

### 🐦 Post for X (Twitter)

```text
AI coding agents write 500 lines of code in seconds. But can the developer explain the boundary conditions? 90% of the time, no.

We just launched GitSpar 🛡️ — an editor-agnostic diagnostic gatekeeper that turns AI-generated diffs into executable comprehension drills.

Here’s why existing solutions fail:
❌ Interview puzzle leetcode: Totally disconnected from the PR.
❌ LLM chat quizzes: Hallucinated trivia that you can just paste back into Claude/Cursor.

How GitSpar works:
1️⃣ Cryptographic diff fingerprinting (SHA-256 bound to your working tree).
2️⃣ Blind Oracle: Strips the function body. You must specify boundary inputs + expected output.
3️⃣ AST Boundary Mutation: We inject a deterministic fault (ts-morph). If you can't pinpoint the line and explain why your test broke, the receipt fails.
4️⃣ GitHub Action Gatekeeper: Automatically blocks unverified PRs and posts verified diagnostic proof.

Zero external chat theater. 100% executable Vitest.

Try it right now:
npx gitspar

⭐ GitHub: https://github.com/devanshdoshi8-byte/gitspar
#vibecoding #softwareengineering #typescript #ai #devtools
```

---

### 💼 Post for LinkedIn

```text
The biggest bottleneck in software engineering in 2026 isn't writing code—it's reviewing AI-generated code.

"Vibe coding" has triggered a severe crisis of Cognitive Debt:
Builders accept complex AI pull requests without understanding edge cases, relational operators, or failure modes. Reviewers, hackathon judges, and open-source maintainers are drowning in submissions the author cannot explain or debug.

Today, we're introducing GitSpar (v0.3.0) 🛡️: An automated, editor-agnostic diagnostic gatekeeper for AI-assisted code.

Instead of testing developers on irrelevant algorithms or generating multiple-choice trivia quizzes that can be bypassed with another AI tab, GitSpar operates directly on the developer's working Git diff:

1. Cryptographic Patch Fingerprinting: Binds the assessment to the exact SHA-256 hash of your working-tree diff.
2. The Blind Independent Oracle: Hides the code body and requires the author to independently specify the expected behavioral boundary contract.
3. Deterministic AST Mutation Drills: Injects isolated boundary mutants using ts-morph. The author must diagnose the faulty line and explain the root cause against a local Vitest harness.
4. Non-Interactive CI Gatekeeper: A plug-and-play GitHub Action that validates the cryptographic receipt before allowing merges.

GitSpar replaces prompt theater with executable mutation verification.

Check out the project and try the CLI:
GitHub: https://github.com/devanshdoshi8-byte/gitspar
Run locally: npx gitspar

#SoftwareEngineering #DevOps #DeveloperTools #OpenSource #GitHubActions #TypeScript #AI
```

---

## 📦 4. npm Deployment Command Reference

The distribution tarball `gitspar-0.3.0.tgz` is packaged and pre-flight tested. To publish to the npm public registry:

```bash
# 1. Log in to npm registry (one-time interactive auth):
npm login

# 2. Publish package:
npm publish --access public
```

---

## 🔗 5. Published Artifacts & Assets

- **Public GitHub Repository:** [https://github.com/devanshdoshi8-byte/gitspar](https://github.com/devanshdoshi8-byte/gitspar)
- **Local Distribution Tarball:** `gitspar-0.3.0.tgz` (14.1 kB packed, 50.2 kB unpacked, 9 files)
- **GitHub Action Workflow:** `.github/workflows/gitspar-gate.yml`
